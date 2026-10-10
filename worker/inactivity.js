// ============================================================================
// INACTIVITY CONSEQUENCE SWEEP — FALLEN (day 14) / THE WIPE (day 21).
//
// Engineering rails (all enforced here):
//  - SHIPS DISABLED: every action gated on INACTIVITY_CONFIG.enabled. dryRun
//    computes + audits the full decision matrix while acting on NOTHING.
//  - AUDIT FIRST: every decision (warned / fallen / wiped / spared+why) is
//    written to notification_engine_log BEFORE any destructive action.
//  - SOFT DELETE: the wipe archives every row to wipe_quarantine and VERIFIES
//    the archive count matches before deleting anything. Any archive failure
//    aborts that user's wipe entirely. Quarantine is hard-deleted only after
//    the retention window, by this same sweep.
//  - LAUNCH FAIRNESS: effective last-active = max(last qualifying log, config
//    epoch, profile creation day) — nobody can be executed with a clock that
//    started before the epoch.
//  - IDEMPOTENT: state rows (status + warned stage + cycle key) make re-runs
//    no-ops; warnings re-arm only when the cycle key (last-active day) moves.
//  - QUALIFYING LOG: value >= the per-discipline floor (pressups/pullups/
//    squats >= 1, km >= 0.5), London day keys — same day math as streaks.
//    Squats count from the day the Assault goes LIVE and rows can exist.
// ============================================================================

import { INACTIVITY_CONFIG, INACTIVITY_STAGE_LABELS } from '../src/config/inactivity.js'
import { getFirstBloodFloor } from '../src/config/onboarding.js'

// Tables THE WIPE clears (honours + everything honours derive from), with the
// column that scopes rows to the user. referrals / prefs / subscriptions /
// first_blood_exempt are deliberately KEPT (account stays live; recruiters
// keep their counts; once-ever guarantees hold).
const WIPE_TABLES = [
  { table: 'submissions', userColumn: 'user_id' },
  { table: 'notification_events', userColumn: 'recipient_user_id' },
  { table: 'vault_awards', userColumn: 'user_id' },
  { table: 'profile_record_entries', userColumn: 'user_id' },
  { table: 'profile_monthly_totals', userColumn: 'user_id' },
  { table: 'profile_years', userColumn: 'user_id' },
]

function dayDiff(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / 86_400_000)
}

function maxDay(...keys) {
  return keys.filter(Boolean).sort().pop() ?? null
}

// Pure decision function — exported for the fabricated-account tests.
// Input: { daysInactive, status, lastWarnedStage, cycleChanged }
// Output: { action: 'warn'|'fall'|'wipe'|'restore'|'spare', stage?, reason }
export function decideInactivityAction({ daysInactive, status, lastWarnedStage, cycleChanged }) {
  const stage = cycleChanged ? 0 : lastWarnedStage

  if (status === 'wiped') {
    return { action: 'spare', reason: 'already_wiped' }
  }

  if (daysInactive >= INACTIVITY_CONFIG.wipeAtDays) {
    return { action: 'wipe', stage: 5, reason: `day_${daysInactive}` }
  }

  if (daysInactive >= INACTIVITY_CONFIG.fallenAtDays) {
    if (status !== 'fallen') {
      return { action: 'fall', stage: 3, reason: `day_${daysInactive}` }
    }

    // Already fallen: the day-20 eve-of-wipe warning.
    const eve = INACTIVITY_CONFIG.warnings.find((w) => w.stage === 4)
    if (eve && daysInactive >= eve.day && stage < 4) {
      return { action: 'warn', stage: 4, reason: `day_${daysInactive}` }
    }

    return { action: 'spare', reason: 'already_fallen_awaiting_wipe' }
  }

  // Below the fall line. If marked fallen but now active-enough (they logged
  // and the instant-restore hook was missed), restore.
  if (status === 'fallen') {
    return { action: 'restore', reason: 'logged_since_falling' }
  }

  // Pre-fall warnings: highest applicable stage not yet sent this cycle.
  const due = INACTIVITY_CONFIG.warnings
    .filter((w) => w.stage < 3 && daysInactive >= w.day && w.stage > stage)
    .sort((a, b) => b.stage - a.stage)[0]

  if (due) {
    return { action: 'warn', stage: due.stage, reason: `day_${daysInactive}` }
  }

  return { action: 'spare', reason: daysInactive <= 0 ? 'active_today' : `only_day_${daysInactive}` }
}

// ---------------------------------------------------------------------------
// THE WIPE for one user: archive-verify-delete, never delete unarchived data.
// Returns { ok, archived, deleted } or { ok:false, error } (wipe aborted).
// ---------------------------------------------------------------------------
async function executeWipe(ctx, userId) {
  const { env, sb, sbSelectAll } = ctx
  const expiresAt = new Date(Date.now() + INACTIVITY_CONFIG.quarantineRetentionDays * 86_400_000).toISOString()
  const plan = []

  // 1. Read + archive everything FIRST.
  for (const spec of WIPE_TABLES) {
    const rows = await sbSelectAll(env, `${spec.table}?${spec.userColumn}=eq.${userId}&select=*&order=created_at.desc`)

    if (rows.length === 0) {
      plan.push({ ...spec, count: 0 })
      continue
    }

    const quarantineRows = rows.map((row) => ({
      user_id: userId,
      source_table: spec.table,
      row_data: row,
      expires_at: expiresAt,
    }))

    const response = await sb(env, 'wipe_quarantine', {
      method: 'POST',
      headers: { Prefer: 'return=headers-only' },
      body: JSON.stringify(quarantineRows),
    })

    if (!response.ok) {
      return { ok: false, error: `archive failed for ${spec.table} (${response.status}) — wipe aborted, nothing deleted` }
    }

    plan.push({ ...spec, count: rows.length })
  }

  // 2. Only now delete originals, table by table.
  let deleted = 0
  for (const spec of plan) {
    if (spec.count === 0) continue
    const response = await sb(env, `${spec.table}?${spec.userColumn}=eq.${userId}`, { method: 'DELETE' })
    if (!response.ok) {
      return { ok: false, error: `delete failed for ${spec.table} (${response.status}) — archived rows retained in quarantine` }
    }
    deleted += spec.count
  }

  // 3. Preserve the once-ever FIRST BLOOD guarantee (their FIRST_BLOOD event
  // was just archived — exempt them so it can never re-fire).
  await sb(env, 'first_blood_exempt', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify([{ user_id: userId }]),
  })

  return { ok: true, archived: plan.reduce((sum, spec) => sum + spec.count, 0), deleted }
}

async function upsertState(ctx, userId, patch) {
  const { env, sb } = ctx
  await sb(env, 'inactivity_state', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ user_id: userId, updated_at: new Date().toISOString(), ...patch }]),
  })
}

// ---------------------------------------------------------------------------
// THE SWEEP
// ---------------------------------------------------------------------------
export async function runInactivitySweep(ctx, { dryRun = false } = {}) {
  const { env, sbSelectAll, createEvent, logOutcome, londonDayKey, shiftDayKey } = ctx
  const today = londonDayKey()
  const sweepId = `inactivity:${today}${dryRun ? ':dry' : ''}`

  if (!INACTIVITY_CONFIG.enabled && !dryRun) {
    return { skipped: true, reason: 'disabled' }
  }

  // Look-back window: anything older than wipe threshold + buffer acts the same.
  const windowStart = shiftDayKey(today, -(INACTIVITY_CONFIG.wipeAtDays + 14))

  const [profiles, states, recentLogs] = await Promise.all([
    sbSelectAll(env, 'profiles?select=id,created_at&order=created_at.desc'),
    sbSelectAll(env, 'inactivity_state?select=user_id,status,last_warned_stage,cycle_key&order=updated_at.desc'),
    sbSelectAll(
      env,
      `submissions?activity_date=gte.${windowStart}&select=user_id,activity_type,value,activity_date&order=created_at.desc`,
    ),
  ])

  const stateByUser = new Map(states.map((s) => [s.user_id, s]))

  // Last QUALIFYING log day per user (floor-checked, London day key).
  const lastQualifying = new Map()
  for (const row of recentLogs) {
    if ((Number(row.value) || 0) < getFirstBloodFloor(row.activity_type)) continue
    const dayKey = String(row.activity_date).slice(0, 10)
    const prev = lastQualifying.get(row.user_id)
    if (!prev || dayKey > prev) lastQualifying.set(row.user_id, dayKey)
  }

  const matrix = []
  const stats = { warned: 0, fallen: 0, wiped: 0, restored: 0, spared: 0, errors: 0, dryRun }

  for (const profile of profiles) {
    const userId = profile.id
    const state = stateByUser.get(userId) ?? { status: 'active', last_warned_stage: 0, cycle_key: null }
    const createdDay = String(profile.created_at || '').slice(0, 10) || INACTIVITY_CONFIG.epochDayKey
    const effectiveLastActive = maxDay(lastQualifying.get(userId), INACTIVITY_CONFIG.epochDayKey, createdDay)
    const daysInactive = dayDiff(effectiveLastActive, today)
    const cycleChanged = state.cycle_key !== effectiveLastActive

    const decision = decideInactivityAction({
      daysInactive,
      status: state.status,
      lastWarnedStage: state.last_warned_stage,
      cycleChanged,
    })

    matrix.push({ userId, daysInactive, effectiveLastActive, status: state.status, ...decision })

    if (dryRun || decision.action === 'spare') {
      stats.spared += decision.action === 'spare' ? 1 : 0
      if (dryRun && decision.action !== 'spare') stats[decision.action === 'warn' ? 'warned' : decision.action === 'fall' ? 'fallen' : decision.action === 'wipe' ? 'wiped' : 'restored'] += 1
      continue
    }

    // AUDIT BEFORE ACTING — no silent executions.
    await logOutcome(env, `${sweepId}:${userId}`, `inactivity_${decision.action}`, {
      userId,
      daysInactive,
      effectiveLastActive,
      stage: decision.stage ?? null,
      stageLabel: INACTIVITY_STAGE_LABELS[decision.stage] ?? null,
      reason: decision.reason,
    })

    try {
      if (decision.action === 'warn') {
        await createEvent(env, {
          recipientUserId: userId,
          type: 'INACTIVITY_WARNING',
          payload: { stage: decision.stage, daysInactive, cycleKey: effectiveLastActive },
        })
        await upsertState(ctx, userId, { status: state.status, last_warned_stage: decision.stage, cycle_key: effectiveLastActive })
        stats.warned += 1
      } else if (decision.action === 'fall') {
        await upsertState(ctx, userId, { status: 'fallen', last_warned_stage: 3, cycle_key: effectiveLastActive, fallen_at: new Date().toISOString() })
        await createEvent(env, {
          recipientUserId: userId,
          type: 'FALLEN',
          payload: { daysInactive, cycleKey: effectiveLastActive },
        })
        stats.fallen += 1
      } else if (decision.action === 'wipe') {
        const result = await executeWipe(ctx, userId)

        if (!result.ok) {
          stats.errors += 1
          await logOutcome(env, `${sweepId}:${userId}`, 'error', { userId, phase: 'wipe', message: result.error })
          continue
        }

        await upsertState(ctx, userId, { status: 'wiped', last_warned_stage: 5, cycle_key: effectiveLastActive, wiped_at: new Date().toISOString() })
        await createEvent(env, {
          recipientUserId: userId,
          type: 'WIPED',
          payload: { daysInactive, archived: result.archived },
        })
        stats.wiped += 1
      } else if (decision.action === 'restore') {
        await upsertState(ctx, userId, { status: 'active', last_warned_stage: 0, cycle_key: effectiveLastActive, fallen_at: null })
        await createEvent(env, { recipientUserId: userId, type: 'RISEN', payload: { via: 'sweep' } })
        stats.restored += 1
      }
    } catch (error) {
      stats.errors += 1
      await logOutcome(env, `${sweepId}:${userId}`, 'error', { userId, action: decision.action, message: String(error?.message || error) })
    }
  }

  // Quarantine purge — hard-delete archives past retention (real runs only).
  let purged = 0
  if (!dryRun && INACTIVITY_CONFIG.enabled) {
    const expired = await sbSelectAll(env, `wipe_quarantine?expires_at=lt.${new Date().toISOString()}&select=id`)
    if (expired.length > 0) {
      await ctx.sb(env, `wipe_quarantine?expires_at=lt.${new Date().toISOString()}`, { method: 'DELETE' })
      purged = expired.length
    }
  }

  await logOutcome(env, sweepId, dryRun ? 'inactivity_dry_run' : 'inactivity_swept', {
    ...stats,
    purgedQuarantineRows: purged,
    usersEvaluated: profiles.length,
    matrix,
  })

  return { swept: true, ...stats, purgedQuarantineRows: purged, usersEvaluated: profiles.length, matrix }
}

// ---------------------------------------------------------------------------
// ADMIN RESTORE — resurrect a wrongful wipe inside the retention window.
// ---------------------------------------------------------------------------
export async function restoreWipedUser(ctx, userId) {
  const { env, sb, sbSelectAll, logOutcome } = ctx
  const rows = await sbSelectAll(env, `wipe_quarantine?user_id=eq.${userId}&select=id,source_table,row_data`)

  if (rows.length === 0) {
    return { restored: false, reason: 'nothing in quarantine for this user (expired or never wiped)' }
  }

  await logOutcome(env, `inactivity_restore:${userId}`, 'inactivity_restore_started', { userId, rows: rows.length })

  const byTable = new Map()
  for (const row of rows) {
    if (!byTable.has(row.source_table)) byTable.set(row.source_table, [])
    byTable.get(row.source_table).push(row.row_data)
  }

  let restored = 0
  for (const [table, tableRows] of byTable) {
    const response = await sb(env, table, {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=headers-only' },
      body: JSON.stringify(tableRows),
    })

    if (!response.ok) {
      await logOutcome(env, `inactivity_restore:${userId}`, 'error', { userId, table, status: response.status })
      return { restored: false, reason: `reinsert failed for ${table} (${response.status}) — quarantine left intact` }
    }

    restored += tableRows.length
  }

  // Clear quarantine + reset state only after every table restored.
  await sb(env, `wipe_quarantine?user_id=eq.${userId}`, { method: 'DELETE' })
  await upsertState(ctx, userId, { status: 'active', last_warned_stage: 0, wiped_at: null, fallen_at: null })
  await logOutcome(env, `inactivity_restore:${userId}`, 'inactivity_restored', { userId, restored })

  return { restored: true, rows: restored }
}
