// ============================================================================
// ONLY GAINS — NOTIFICATION WORKER
// The re-engagement engine. Detects "moments that matter" after each
// submission, persists them as notification_events, and fires web pushes.
//
// Routes (run_worker_first: /api/* — everything else is static assets):
//   POST /api/events/process   { submissionId }  fire-and-forget from client
//   POST /api/events/test-fire { type, recipientUserId, actorName?, payload? }
//                              Authorization: Bearer <TEST_FIRE_TOKEN>
//   GET  /api/health
// Cron: evening STREAK_AT_RISK sweep (see wrangler.jsonc triggers).
//
// Secrets (Cloudflare dashboard -> Workers -> Settings -> Variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...),
//   TEST_FIRE_TOKEN
//
// Design rule: this worker NEVER sits in the logging write path. The client
// pings it after a successful save; if the worker is down, logging is
// completely unaffected — only notifications go quiet.
// ============================================================================

import { buildPushPayload } from '@block65/webcrypto-web-push'
import { NOTIFICATIONS_CONFIG, getEventConfig } from '../src/config/notifications.js'
import { CROWNS_CONFIG } from '../src/config/crowns.js'
import { ONBOARDING_CONFIG, getFirstBloodFloor } from '../src/config/onboarding.js'
import { AIR_SQUAT_ASSAULT_CONFIG } from '../src/config/airSquatAssault.js'
import { AIR_SQUAT_ASSAULT_COPY } from '../src/copy/airSquatAssaultCopy.js'
import { getNotificationCopy } from '../src/copy/notificationTemplates.js'

// ---------------------------------------------------------------------------
// Supabase REST (service role) helpers
// ---------------------------------------------------------------------------

// Tolerates the common dashboard paste accidents in SUPABASE_URL: trailing
// whitespace, trailing slash, or a pasted /rest/v1 suffix — any of which
// turn every PostgREST request into a gateway 404.
function supabaseBaseUrl(env) {
  return String(env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
}

function sb(env, path, init = {}) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  return fetch(`${supabaseBaseUrl(env)}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

// Failed requests surface the response body — a 404 from a missing table
// reads completely differently to a 404 from a malformed base URL, and the
// next person debugging this deserves to know which one they have.
async function sbFail(response, verb, path) {
  const body = (await response.text().catch(() => '')).slice(0, 200)
  throw new Error(`Supabase ${verb} failed (${response.status}): ${path} :: ${body}`)
}

async function sbSelect(env, path) {
  const response = await sb(env, path)

  if (!response.ok) {
    await sbFail(response, 'select', path)
  }

  return response.json()
}

// PostgREST silently caps responses (Supabase default: 1000 rows) — and with
// no order clause that cap eats the NEWEST rows first. This walks Range
// pages until a short page, so big boards never lose the current week.
const PAGE_SIZE = 1000

async function sbSelectAll(env, path) {
  const rows = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await sb(env, path, {
      headers: { 'Range-Unit': 'items', Range: `${offset}-${offset + PAGE_SIZE - 1}` },
    })

    if (!response.ok) {
      await sbFail(response, 'select', path)
    }

    const page = await response.json()
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      return rows
    }
  }
}

// Permanent observability: every processed ping records an outcome. Failures
// to log never fail the engine (table may not exist until migration runs).
async function logOutcome(env, submissionId, outcome, detail = {}) {
  console.log('[engine]', submissionId, outcome, JSON.stringify(detail))

  try {
    await sb(env, 'notification_engine_log', {
      method: 'POST',
      body: JSON.stringify([{ submission_id: submissionId, outcome, detail }]),
    })
  } catch {
    // Observability must never take the engine down.
  }
}

async function sbInsert(env, table, rows) {
  const response = await sb(env, table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    await sbFail(response, 'insert', table)
  }

  return response.json()
}

// ---------------------------------------------------------------------------
// London-day helpers (mirror of src/utils/dates.js, dependency-free)
// ---------------------------------------------------------------------------

const londonFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function londonDayKey(date = new Date()) {
  return londonFormatter.format(date)
}

function shiftDayKey(dayKey, days) {
  const date = new Date(`${dayKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function londonWeekStart(dayKey) {
  const date = new Date(`${dayKey}T12:00:00.000Z`)
  const daysFromMonday = (date.getUTCDay() + 6) % 7
  return shiftDayKey(dayKey, -daysFromMonday)
}

function formatValue(value, activityType) {
  if (activityType === 'km') {
    const normalized = Number(Number(value).toFixed(2))
    return `${normalized} km`
  }

  return `${Math.round(Number(value) || 0)} reps`
}

// ---------------------------------------------------------------------------
// Preferences + anti-spam gates
// ---------------------------------------------------------------------------

async function getPrefs(env, userId) {
  // No prefs row — or no reachable prefs table — means defaults. A missing
  // preference must never kill a war report.
  try {
    const rows = await sbSelect(env, `notification_prefs?user_id=eq.${userId}&select=global_mute,categories`)
    const row = rows[0]

    return {
      globalMute: row?.global_mute ?? false,
      categories: { ...NOTIFICATIONS_CONFIG.defaultCategories, ...(row?.categories ?? {}) },
    }
  } catch (error) {
    console.log('[engine] prefs lookup failed, using defaults', String(error?.message || error))
    return {
      globalMute: false,
      categories: { ...NOTIFICATIONS_CONFIG.defaultCategories },
    }
  }
}

async function passesGates(env, recipientId, type) {
  const config = getEventConfig(type)
  const prefs = await getPrefs(env, recipientId)

  if (prefs.globalMute || prefs.categories[config.category] === false) {
    return false
  }

  if (config.cooldownMinutes > 0) {
    const cutoff = new Date(Date.now() - config.cooldownMinutes * 60_000).toISOString()
    const recent = await sbSelect(
      env,
      `notification_events?recipient_user_id=eq.${recipientId}&type=eq.${type}&created_at=gte.${cutoff}&select=id&limit=1`,
    )

    if (recent.length > 0) {
      return false
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Event creation + push
// ---------------------------------------------------------------------------

async function createEvent(env, { recipientUserId, type, actorUserId = null, actorName = null, payload = {} }) {
  if (!(await passesGates(env, recipientUserId, type))) {
    return null
  }

  // BOARD_ACTIVITY collapses into a single unread digest per window.
  if (type === 'BOARD_ACTIVITY') {
    const windowStart = new Date(Date.now() - NOTIFICATIONS_CONFIG.collapseWindowMinutes * 60_000).toISOString()
    const existing = await sbSelect(
      env,
      `notification_events?recipient_user_id=eq.${recipientUserId}&type=eq.BOARD_ACTIVITY&read_at=is.null&created_at=gte.${windowStart}&select=id,payload,actor_name&limit=1`,
    )

    if (existing.length > 0) {
      const digest = existing[0]
      const mergedNames = [...new Set([...(digest.payload?.names ?? [digest.actor_name]), actorName])].filter(Boolean)
      await sb(env, `notification_events?id=eq.${digest.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          payload: { ...digest.payload, count: mergedNames.length, names: mergedNames },
          created_at: new Date().toISOString(),
        }),
      })
      return null // digest updated, no new push for low priority anyway
    }
  }

  const config = getEventConfig(type)
  const [event] = await sbInsert(env, 'notification_events', [
    {
      recipient_user_id: recipientUserId,
      type,
      priority: config.priority,
      actor_user_id: actorUserId,
      actor_name: actorName,
      payload,
    },
  ])

  const shouldPush =
    NOTIFICATIONS_CONFIG.pushPriorities.includes(config.priority) ||
    (config.priority === 'low' && NOTIFICATIONS_CONFIG.pushLowPriority)

  if (shouldPush && event) {
    await sendPush(env, event).catch(() => {
      // Push failure never fails event creation.
    })
  }

  return event
}

async function sendPush(env, event) {
  const subscriptions = await sbSelect(
    env,
    `push_subscriptions?user_id=eq.${event.recipient_user_id}&select=id,endpoint,keys`,
  )

  if (subscriptions.length === 0) {
    return
  }

  const copy = getNotificationCopy(event)
  const message = {
    data: JSON.stringify({ title: copy.title, body: copy.body, url: copy.url, eventId: event.id }),
    options: { ttl: 86_400, urgency: event.priority === 'high' ? 'high' : 'normal' },
  }
  const vapid = {
    subject: env.VAPID_SUBJECT || 'mailto:admin@onlygains.club',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const sub = { endpoint: subscription.endpoint, keys: subscription.keys }
        const payload = await buildPushPayload(message, sub, vapid)
        const response = await fetch(subscription.endpoint, payload)

        // Dead subscription: prune so we never retry it.
        if (response.status === 404 || response.status === 410) {
          await sb(env, `push_subscriptions?id=eq.${subscription.id}`, { method: 'DELETE' })
        } else {
          await sb(env, `push_subscriptions?id=eq.${subscription.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ last_used_at: new Date().toISOString() }),
          })
        }
      } catch {
        // One bad endpoint never blocks the others.
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// Submission processing — the moment detector
// ---------------------------------------------------------------------------

async function fetchProfileNames(env, userIds) {
  const unique = [...new Set(userIds.filter(Boolean))]

  if (unique.length === 0) {
    return {}
  }

  const rows = await sbSelect(env, `profiles?id=in.(${unique.join(',')})&select=id,name`)
  return Object.fromEntries(rows.map((row) => [row.id, row.name || 'A rival']))
}

async function processSubmission(env, submissionId) {
  const rows = await sbSelect(
    env,
    `submissions?id=eq.${submissionId}&select=id,circle_id,user_id,activity_type,value,activity_date,year`,
  )
  const submission = rows[0]

  if (!submission) {
    await logOutcome(env, submissionId, 'not_found')
    return { processed: false, outcome: 'not_found', reason: 'submission not found' }
  }

  const { circle_id: circleId, user_id: actorId, activity_type: activityType, value } = submission
  const todayKey = londonDayKey()
  const weekStart = londonWeekStart(todayKey)

  // Two precise, paginated queries instead of one whole-year board dump
  // (which Supabase capped at 1000 unordered rows — silently dropping the
  // current week on big boards; the bug that made real overtakes invisible).
  const [weekRows, actorYearRows] = await Promise.all([
    sbSelectAll(
      env,
      `submissions?circle_id=eq.${circleId}&activity_type=eq.${activityType}&activity_date=gte.${weekStart}&select=user_id,value,activity_date&order=created_at.desc`,
    ),
    sbSelectAll(
      env,
      `submissions?user_id=eq.${actorId}&circle_id=eq.${circleId}&activity_type=eq.${activityType}&year=eq.${submission.year}&select=value&order=created_at.desc`,
    ),
  ])

  const weeklyTotals = new Map()
  const actorLifetime = actorYearRows.reduce((sum, row) => sum + (Number(row.value) || 0), 0)

  for (const row of weekRows) {
    const dayKey = String(row.activity_date).slice(0, 10)

    if (dayKey >= weekStart && dayKey <= todayKey) {
      weeklyTotals.set(row.user_id, (weeklyTotals.get(row.user_id) ?? 0) + (Number(row.value) || 0))
    }
  }

  const after = [...weeklyTotals.entries()].map(([userId, total]) => ({ userId, total }))
  const actorAfterTotal = weeklyTotals.get(actorId) ?? 0
  const actorBeforeTotal = actorAfterTotal - (Number(value) || 0)

  const rankOf = (list, userId) =>
    list.filter((row) => row.userId !== userId && row.total > (list.find((r) => r.userId === userId)?.total ?? 0)).length + 1

  const actorNewRank = rankOf(after, actorId)

  // Rivals the actor jumped with THIS log: were ahead before, behind now.
  const passed = after.filter(
    (row) => row.userId !== actorId && row.total >= actorBeforeTotal && row.total < actorAfterTotal && row.total > 0,
  )

  const names = await fetchProfileNames(env, [actorId, ...passed.map((row) => row.userId)])
  const actorName = names[actorId] ?? 'A rival'
  const created = []

  // FIRST BLOOD — the actor's first QUALIFYING log (value >= the discipline
  // floor). Blank / 0 / fat-finger entries below the floor never write the
  // durable event, so a junk first entry (even one later deleted) can't burn
  // the once-ever coronation — it waits for the first real set. The durable
  // FIRST_BLOOD event is the cross-device once-ever guard (dedup: no prior
  // event). When it fires it OWNS this log, so MILESTONE is suppressed. The
  // client fires the visual takeover instantly; this is the truth behind it.
  let firstBloodFired = false
  const firstBloodFloor = getFirstBloodFloor(activityType)
  const qualifiesForFirstBlood =
    ONBOARDING_CONFIG.firstBlood.enabled && (Number(value) || 0) >= firstBloodFloor

  if (qualifiesForFirstBlood) {
    // Veteran exemption: accounts that existed at deploy were backfilled into
    // first_blood_exempt and never draw first blood. Gate is account-identity
    // only — NO submission-history dependency.
    const [priorFirstBlood, exemptRows] = await Promise.all([
      sbSelect(env, `notification_events?recipient_user_id=eq.${actorId}&type=eq.FIRST_BLOOD&select=id&limit=1`),
      sbSelect(env, `first_blood_exempt?user_id=eq.${actorId}&select=user_id&limit=1`),
    ])

    if (priorFirstBlood.length === 0 && exemptRows.length === 0) {
      const event = await createEvent(env, {
        recipientUserId: actorId,
        type: 'FIRST_BLOOD',
        actorUserId: actorId,
        actorName,
        payload: { activityType, value: Number(value) || 0, boardId: circleId },
      })
      if (event) {
        created.push(event)
        firstBloodFired = true
      }
    }
  }

  // RECRUIT FIRST BLOOD — when a recruited warrior draws first blood, the
  // recruiter who dragged them in gets the "army grows" report. Separate
  // event to a different person; never collides with the recruit's own
  // coronation. Dormant until the referrals table exists.
  if (firstBloodFired) {
    try {
      const referral = await sbSelect(
        env,
        `referrals?recruit_id=eq.${actorId}&select=recruiter_id&limit=1`,
      )
      const recruiterId = referral[0]?.recruiter_id

      if (recruiterId) {
        const event = await createEvent(env, {
          recipientUserId: recruiterId,
          type: 'RECRUIT_FIRST_BLOOD',
          actorUserId: actorId,
          actorName,
          payload: { recruitId: actorId },
        })
        if (event) {
          created.push(event)
        }
      }
    } catch {
      // referrals table not live yet — recruit's first blood is unaffected.
    }
  }

  // OVERTAKEN — one war report per fallen rival.
  for (const rival of passed) {
    const rivalRank = rankOf(after, rival.userId)
    const event = await createEvent(env, {
      recipientUserId: rival.userId,
      type: 'OVERTAKEN',
      actorUserId: actorId,
      actorName,
      payload: { newRank: rivalRank, activityType, boardId: circleId },
    })
    if (event) created.push(event)
  }

  // OVERTOOK — the victor gloats once, naming the biggest scalp.
  if (passed.length > 0) {
    const biggestScalp = passed.sort((a, b) => b.total - a.total)[0]
    const event = await createEvent(env, {
      recipientUserId: actorId,
      type: 'OVERTOOK',
      actorUserId: biggestScalp.userId,
      actorName: names[biggestScalp.userId] ?? 'A rival',
      payload: { newRank: actorNewRank, activityType, boardId: circleId },
    })
    if (event) created.push(event)
  }

  // CHASE_CLOSING — warn the warrior directly above: footsteps.
  const above = after
    .filter((row) => row.userId !== actorId && row.total > actorAfterTotal)
    .sort((a, b) => a.total - b.total)[0]

  if (above) {
    const gap = above.total - actorAfterTotal
    const { withinPercent, withinAbsolute } = NOTIFICATIONS_CONFIG.chaseClosing
    const absolute = withinAbsolute[activityType] ?? withinAbsolute.pressups

    if (gap <= absolute || gap <= above.total * (withinPercent / 100)) {
      const event = await createEvent(env, {
        recipientUserId: above.userId,
        type: 'CHASE_CLOSING',
        actorUserId: actorId,
        actorName,
        payload: { gapLabel: formatValue(gap, activityType), activityType, boardId: circleId },
      })
      if (event) created.push(event)
    }
  }

  // MILESTONE — lifetime (year) round numbers. Suppressed when FIRST BLOOD
  // already owns this log (the first set never double-fires honors).
  const milestones = NOTIFICATIONS_CONFIG.lifetimeMilestones[activityType] ?? []
  const crossed = milestones.find(
    (mark) => actorLifetime >= mark && actorLifetime - (Number(value) || 0) < mark,
  )

  if (crossed && !firstBloodFired) {
    const event = await createEvent(env, {
      recipientUserId: actorId,
      type: 'MILESTONE',
      actorUserId: actorId,
      actorName,
      payload: {
        line: `${crossed.toLocaleString('en-GB')} ${activityType === 'km' ? 'KM' : activityType.toUpperCase()} THIS YEAR. MOST PEOPLE NEVER WILL. PROVE IT.`,
        activityType,
      },
    })
    if (event) created.push(event)
  }

  // BOARD_ACTIVITY — a big single log rates a (collapsed) digest to the board.
  const bigThreshold = NOTIFICATIONS_CONFIG.boardActivityThresholds[activityType]

  if (bigThreshold != null && Number(value) >= bigThreshold) {
    const boardmates = [...weeklyTotals.keys()].filter((userId) => userId !== actorId)

    for (const mate of boardmates) {
      await createEvent(env, {
        recipientUserId: mate,
        type: 'BOARD_ACTIVITY',
        actorUserId: actorId,
        actorName,
        payload: { count: 1, names: [actorName], valueLabel: formatValue(value, activityType), boardId: circleId },
      })
    }
  }

  // Record the verdict — every ping leaves a readable trace.
  const detail = {
    activityType,
    boardId: circleId,
    weekRowsFetched: weekRows.length,
    warriorsThisWeek: weeklyTotals.size,
    actorBeforeTotal,
    actorAfterTotal,
    actorNewRank,
    rivalsPassed: passed.length,
    actorLifetime,
    firstBloodFired,
    eventsCreated: created.map((event) => `${event.type}->${event.recipient_user_id}`),
  }
  const outcome =
    created.length > 0
      ? 'events_created'
      : passed.length > 0
        ? 'suppressed' // detection fired but cooldown/prefs gated every event
        : 'no_rank_change'

  await logOutcome(env, submissionId, outcome, detail)

  return { processed: true, outcome, eventsCreated: created.length, actorNewRank, detail }
}

// ---------------------------------------------------------------------------
// STREAK_AT_RISK — the evening sweep
// ---------------------------------------------------------------------------

async function runStreakSweep(env) {
  const todayKey = londonDayKey()
  const year = Number(todayKey.slice(0, 4))
  const rows = await sbSelectAll(
    env,
    `submissions?year=eq.${year}&select=user_id,activity_date&order=created_at.desc`,
  )

  const daysByUser = new Map()

  for (const row of rows) {
    const dayKey = String(row.activity_date).slice(0, 10)
    if (!daysByUser.has(row.user_id)) {
      daysByUser.set(row.user_id, new Set())
    }
    daysByUser.get(row.user_id).add(dayKey)
  }

  let fired = 0

  for (const [userId, days] of daysByUser) {
    if (days.has(todayKey)) {
      continue // already trained today — safe
    }

    let cursor = shiftDayKey(todayKey, -1)
    let streakDays = 0

    while (days.has(cursor)) {
      streakDays += 1
      cursor = shiftDayKey(cursor, -1)
    }

    if (streakDays >= 2) {
      const event = await createEvent(env, {
        recipientUserId: userId,
        type: 'STREAK_AT_RISK',
        payload: { streakDays },
      })
      if (event) fired += 1
    }
  }

  return { swept: daysByUser.size, fired }
}

// ---------------------------------------------------------------------------
// CROWNS — period-rollover honors sweep (weekly + monthly, all disciplines)
// ---------------------------------------------------------------------------

const DISCIPLINES = ['pressups', 'pullups', 'km']

const DISCIPLINE_LABELS = {
  pressups: 'Press-ups',
  pullups: 'Pull-ups',
  km: 'KM',
}

function londonMonthStart(dayKey) {
  return `${dayKey.slice(0, 7)}-01`
}

// Period window: by default the LAST COMPLETED period (the cron runs just
// after rollover); current=true sweeps the in-progress period for testing.
function getCrownWindow(period, { current = false } = {}) {
  const todayKey = londonDayKey()

  if (period === 'monthly') {
    const thisMonthStart = londonMonthStart(todayKey)

    if (current) {
      return { start: thisMonthStart, endExclusive: shiftDayKey(todayKey, 1), periodKey: thisMonthStart.slice(0, 7) }
    }

    const lastMonthStart = londonMonthStart(shiftDayKey(thisMonthStart, -1))
    return { start: lastMonthStart, endExclusive: thisMonthStart, periodKey: lastMonthStart.slice(0, 7) }
  }

  const thisWeekStart = londonWeekStart(todayKey)

  if (current) {
    return { start: thisWeekStart, endExclusive: shiftDayKey(todayKey, 1), periodKey: thisWeekStart }
  }

  const lastWeekStart = shiftDayKey(thisWeekStart, -7)
  return { start: lastWeekStart, endExclusive: thisWeekStart, periodKey: lastWeekStart }
}

// One crown event per recipient/type/board/period — re-running the sweep
// (retries, manual fires) can never double-award.
async function crownAlreadyAwarded(env, recipientId, type, boardId, periodKey) {
  const rows = await sbSelect(
    env,
    `notification_events?recipient_user_id=eq.${recipientId}&type=eq.${type}&payload->>periodKey=eq.${periodKey}&payload->>boardId=eq.${boardId}&select=id&limit=1`,
  )

  return rows.length > 0
}

// Faithful port of calculateLeaderboard's ranking: highest total, ties broken
// by todayTotal desc then most-recent-log desc. Returns exactly one champion.
function pickChampion(userStats) {
  return [...userStats.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.todayTotal !== a.todayTotal) return b.todayTotal - a.todayTotal
    return new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime()
  })[0]
}

// Maps a crown outcome to a constraint-legal vault_awards row (see
// db/migrations/2026-06-13_crown_awards_parity.sql). Every value here is
// proven against the widened CHECK constraints.
function buildCrownAwardRow({ boardId, userId, type, period, window, wonDisciplines, disciplineStats, actorName }) {
  const monthly = period === 'monthly'
  const periodEnd = shiftDayKey(window.endExclusive, -1)
  const sum = (keys) => keys.reduce((total, key) => total + (Number(disciplineStats[key]) || 0), 0)

  let awardType
  let activityType
  let unit
  let valueNumeric
  let title

  if (type === 'TREBLE') {
    awardType = monthly ? 'treble_monthly_win' : 'treble_weekly_win'
    activityType = 'combined'
    unit = 'mixed'
    valueNumeric = sum(wonDisciplines)
    title = 'TREBLE CROWN'
  } else if (type === 'DOUBLE_CROWN') {
    awardType = monthly ? 'double_monthly_win' : 'double_weekly_win'
    activityType = 'combined'
    unit = 'mixed'
    valueNumeric = sum(wonDisciplines)
    title = 'DOUBLE CROWN'
  } else {
    const discipline = wonDisciplines[0]
    awardType = monthly ? 'monthly_win' : 'weekly_win'
    activityType = discipline
    unit = discipline === 'km' ? 'km' : 'reps'
    valueNumeric = Number(disciplineStats[discipline]) || 0
    title = `${(DISCIPLINE_LABELS[discipline] || discipline).toUpperCase()} CROWN`
  }

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    circle_id: boardId,
    award_type: awardType,
    activity_type: activityType,
    period_type: period,
    period_start: window.start,
    period_end: periodEnd,
    record_type: `crown_${type.toLowerCase()}`,
    value_numeric: valueNumeric,
    value_seconds: null,
    unit,
    source_type: 'crown',
    source_id: null,
    title,
    quote:
      type === 'TREBLE'
        ? 'ALL THREE THRONES. BOW.'
        : type === 'DOUBLE_CROWN'
          ? `TWO THRONES, ONE ${monthly ? 'MONTH' : 'WEEK'}.`
          : 'THE THRONE IS THEIRS. DEFEND IT.',
    image_path: '/images/macho-toasts/crown-arnold.webp',
    metadata: { disciplines: wonDisciplines, stats: disciplineStats, periodKey: window.periodKey, tier: type },
    created_at: new Date().toISOString(),
  }
}

// Writes the shareable vault_awards row for a crown, deduped on
// (circle_id, user_id, period_type, period_start) for source_type='crown'
// (check-before-insert + the partial unique index as a hard backstop).
// Returns 'created' | 'exists' | 'error'. A failure here never breaks the
// crown honor — it's logged and reported.
async function recordCrownAward(env, args) {
  try {
    const { boardId, userId, period, window } = args
    const existing = await sbSelect(
      env,
      `vault_awards?circle_id=eq.${boardId}&user_id=eq.${userId}&period_type=eq.${period}&period_start=eq.${window.start}&source_type=eq.crown&select=id&limit=1`,
    )

    if (existing.length > 0) {
      return 'exists'
    }

    const response = await sb(env, 'vault_awards', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify([buildCrownAwardRow(args)]),
    })

    if (!response.ok) {
      const body = (await response.text().catch(() => '')).slice(0, 200)
      console.log('[engine] crown award insert failed', response.status, body)
      return 'error'
    }

    return 'created'
  } catch (error) {
    console.log('[engine] crown award insert threw', String(error?.message || error))
    return 'error'
  }
}

async function runCrownsSweep(env, period, { current = false } = {}) {
  const window = getCrownWindow(period, { current })
  const sweepId = `crowns:${period}:${window.periodKey}`
  const minWarriors = CROWNS_CONFIG.minWarriorsPerDiscipline
  const todayKey = londonDayKey()

  try {
    const rows = await sbSelectAll(
      env,
      `submissions?activity_date=gte.${window.start}&activity_date=lt.${window.endExclusive}&select=circle_id,user_id,activity_type,value,activity_date,created_at&order=created_at.desc`,
    )

    // totals[board][discipline][user] -> { total, todayTotal, lastCreatedAt }
    const totals = new Map()

    for (const row of rows) {
      if (!DISCIPLINES.includes(row.activity_type)) {
        continue
      }

      const boardKey = row.circle_id
      if (!totals.has(boardKey)) totals.set(boardKey, new Map())
      const board = totals.get(boardKey)
      if (!board.has(row.activity_type)) board.set(row.activity_type, new Map())
      const discipline = board.get(row.activity_type)
      const value = Number(row.value) || 0
      const existing = discipline.get(row.user_id) ?? { userId: row.user_id, total: 0, todayTotal: 0, lastCreatedAt: row.created_at }

      existing.total += value
      if (String(row.activity_date).slice(0, 10) === todayKey) {
        existing.todayTotal += value
      }
      if (new Date(row.created_at).getTime() > new Date(existing.lastCreatedAt).getTime()) {
        existing.lastCreatedAt = row.created_at
      }

      discipline.set(row.user_id, existing)
    }

    const stats = { boards: totals.size, crowns: 0, doubles: 0, trebles: 0, reports: 0, skippedDuplicates: 0, awards: 0, awardsSkipped: 0, standings: [] }

    for (const [boardId, disciplines] of totals) {
      const boardMembers = new Set()
      const crownsByUser = new Map() // user -> [discipline keys]
      const championTotals = {} // user -> { [discipline]: total } for the treble card
      const boardStanding = { boardId, disciplines: [] }

      for (const disciplineKey of DISCIPLINES) {
        const userStats = disciplines.get(disciplineKey)

        if (userStats) {
          for (const userId of userStats.keys()) {
            boardMembers.add(userId)
          }
        }

        const activeWarriors = userStats ? [...userStats.values()].filter((stat) => stat.total > 0).length : 0

        // Minimum-warrior gate: too few warriors, no real crown.
        if (!userStats || activeWarriors < minWarriors) {
          boardStanding.disciplines.push({ discipline: disciplineKey, champion: null, activeWarriors, gated: true })
          continue
        }

        const champion = pickChampion(userStats)

        if (!champion || champion.total <= 0) {
          boardStanding.disciplines.push({ discipline: disciplineKey, champion: null, activeWarriors, gated: false })
          continue
        }

        if (!crownsByUser.has(champion.userId)) crownsByUser.set(champion.userId, [])
        crownsByUser.get(champion.userId).push(disciplineKey)
        championTotals[champion.userId] = { ...(championTotals[champion.userId] ?? {}), [disciplineKey]: champion.total }

        boardStanding.disciplines.push({
          discipline: disciplineKey,
          champion: champion.userId,
          championTotal: champion.total,
          activeWarriors,
          gated: false,
        })
      }

      stats.standings.push(boardStanding)
      const names = await fetchProfileNames(env, [...boardMembers])

      for (const [userId, wonDisciplines] of crownsByUser) {
        const type = wonDisciplines.length >= 3 ? 'TREBLE' : wonDisciplines.length === 2 ? 'DOUBLE_CROWN' : 'CROWN'
        const disciplineStats = championTotals[userId] ?? {}

        // --- Honor side (notification_events), deduped on its own key. ---
        if (await crownAlreadyAwarded(env, userId, type, boardId, window.periodKey)) {
          stats.skippedDuplicates += 1
        } else {
          const payload = {
            period,
            periodKey: window.periodKey,
            boardId,
            disciplines: wonDisciplines,
            discipline: wonDisciplines.map((d) => DISCIPLINE_LABELS[d]).join(' + '),
            stats: disciplineStats,
          }

          const event = await createEvent(env, {
            recipientUserId: userId,
            type,
            actorUserId: userId,
            actorName: names[userId] ?? 'A warrior',
            payload,
          })

          if (event) {
            if (type === 'TREBLE') stats.trebles += 1
            else if (type === 'DOUBLE_CROWN') stats.doubles += 1
            else stats.crowns += 1
          }

          // Doubles and trebles broadcast to every other board member.
          if (type !== 'CROWN') {
            for (const member of boardMembers) {
              if (member === userId) {
                continue
              }

              if (await crownAlreadyAwarded(env, member, 'CROWN_REPORT', boardId, `${window.periodKey}:${userId}`)) {
                continue
              }

              const report = await createEvent(env, {
                recipientUserId: member,
                type: 'CROWN_REPORT',
                actorUserId: userId,
                actorName: names[userId] ?? 'A warrior',
                payload: { period, periodKey: `${window.periodKey}:${userId}`, boardId, honor: type },
              })

              if (report) stats.reports += 1
            }
          }
        }

        // --- Shareable artifact (vault_awards), deduped INDEPENDENTLY so a
        // champion whose honor already existed (e.g. cron ran before parity
        // shipped) still gets their /award/ page backfilled. ---
        const awardResult = await recordCrownAward(env, {
          boardId,
          userId,
          type,
          period,
          window,
          wonDisciplines,
          disciplineStats,
          actorName: names[userId] ?? 'A warrior',
        })
        if (awardResult === 'created') stats.awards += 1
        else if (awardResult === 'exists') stats.awardsSkipped += 1
      }
    }

    await logOutcome(env, sweepId, 'crowns_swept', { ...stats, window })
    return { swept: true, ...stats, window }
  } catch (error) {
    await logOutcome(env, sweepId, 'error', { message: String(error?.message || error) })
    throw error
  }
}

// ---------------------------------------------------------------------------
// EVENT LAUNCH BROADCAST — one-off push to a timed event's opt-in list only
// ---------------------------------------------------------------------------

// Targets ONLY event_optins for the event (never the whole user base). Idempotent:
// a per-recipient EVENT_LAUNCH dedupe on the event key means firing twice sends
// each warrior exactly once. Copy is the event's own launchPush.
async function runEventLaunchBroadcast(env) {
  const eventKey = AIR_SQUAT_ASSAULT_CONFIG.eventKey
  const copy = AIR_SQUAT_ASSAULT_COPY.launchPush
  const optins = await sbSelectAll(env, `event_optins?event_key=eq.${eventKey}&select=user_id`)

  let sent = 0
  let skipped = 0

  for (const row of optins) {
    const userId = row.user_id

    const prior = await sbSelect(
      env,
      `notification_events?recipient_user_id=eq.${userId}&type=eq.EVENT_LAUNCH&payload->>eventKey=eq.${eventKey}&select=id&limit=1`,
    )

    if (prior.length > 0) {
      skipped += 1
      continue
    }

    const event = await createEvent(env, {
      recipientUserId: userId,
      type: 'EVENT_LAUNCH',
      actorUserId: userId,
      actorName: '',
      payload: { eventKey, title: copy.title, body: copy.body, url: copy.url },
    })

    if (event) {
      sent += 1
    } else {
      skipped += 1
    }
  }

  await logOutcome(env, `event_launch:${eventKey}`, 'event_launch_broadcast', {
    eventKey,
    optins: optins.length,
    sent,
    skipped,
  })

  return { eventKey, optins: optins.length, sent, skipped }
}

// ---------------------------------------------------------------------------
// HTTP surface
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// One auth path for every token-gated endpoint — no per-route drift.
// Trims both sides so a stray newline pasted into the dashboard secret
// can never cause a mystery 401.
function isAuthorized(request, env) {
  const token = String(env.TEST_FIRE_TOKEN || '').trim()
  const header = String(request.headers.get('Authorization') || '').trim()

  return Boolean(token) && header === `Bearer ${token}`
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return json({ ok: true })
    }

    if (url.pathname === '/api/events/process' && request.method === 'POST') {
      let submissionId = ''

      try {
        const body = await request.json()
        submissionId = body.submissionId || ''

        if (!submissionId) {
          return json({ error: 'submissionId required' }, 400)
        }

        const result = await processSubmission(env, submissionId)
        return json(result)
      } catch (error) {
        // The ping is fire-and-forget client-side, so an unrecorded error
        // here would vanish. Every failure leaves a trace.
        await logOutcome(env, submissionId || 'unknown', 'error', {
          message: String(error?.message || error),
        })
        return json({ outcome: 'error', error: String(error?.message || error) }, 500)
      }
    }

    // Read the engine's recent verdicts without dashboard access:
    // GET /api/events/log?limit=20 with the test-fire bearer token.
    if (url.pathname === '/api/events/log' && request.method === 'GET') {
      if (!isAuthorized(request, env)) {
        return json({ error: 'unauthorized' }, 401)
      }

      const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)

      try {
        const rows = await sbSelect(
          env,
          `notification_engine_log?select=submission_id,outcome,detail,created_at&order=created_at.desc&limit=${limit}`,
        )
        return json(rows)
      } catch (error) {
        return json({ error: String(error?.message || error) }, 500)
      }
    }

    if (url.pathname === '/api/events/test-fire' && request.method === 'POST') {
      if (!isAuthorized(request, env)) {
        return json({ error: 'unauthorized' }, 401)
      }

      try {
        const body = await request.json()

        if (body.sweep) {
          return json(await runStreakSweep(env))
        }

        // Manual crowns run: { "crowns": "weekly"|"monthly", "current": true }
        // current=true scores the in-progress period (for testing without
        // waiting for rollover).
        if (body.crowns) {
          return json(await runCrownsSweep(env, body.crowns === 'monthly' ? 'monthly' : 'weekly', { current: Boolean(body.current) }))
        }

        const event = await createEvent(env, {
          recipientUserId: body.recipientUserId,
          type: body.type || 'OVERTAKEN',
          actorUserId: body.actorUserId ?? null,
          actorName: body.actorName ?? 'TEST RIVAL',
          payload: body.payload ?? { newRank: 4, streakDays: 7, gapLabel: '18 reps', line: 'TEST FIRE. THE WIRE WORKS.' },
        })

        return json({ created: Boolean(event), event })
      } catch (error) {
        return json({ error: String(error?.message || error) }, 500)
      }
    }

    // Admin manual override: run the crown sweep now. Same logic as the cron,
    // safe against double-award (recordCrownAward + crownAlreadyAwarded dedupe).
    // Auth = the caller's own Supabase JWT must satisfy is_current_user_admin
    // (reuses the app's existing admin gate; no shared secret in the client).
    if (url.pathname === '/api/admin/run-crowns' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || ''

      if (!authHeader.toLowerCase().startsWith('bearer ')) {
        return json({ error: 'unauthorized' }, 401)
      }

      try {
        const adminCheck = await fetch(`${supabaseBaseUrl(env)}/rest/v1/rpc/is_current_user_admin`, {
          method: 'POST',
          headers: {
            apikey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
            Authorization: authHeader, // the caller's user JWT -> auth.uid()
            'Content-Type': 'application/json',
          },
          body: '{}',
        })

        const isAdmin = adminCheck.ok && (await adminCheck.json()) === true

        if (!isAdmin) {
          return json({ error: 'admin only' }, 403)
        }

        const body = await request.json().catch(() => ({}))
        const period = body.period === 'monthly' ? 'monthly' : 'weekly'
        const result = await runCrownsSweep(env, period, { current: Boolean(body.current) })
        return json(result)
      } catch (error) {
        return json({ error: String(error?.message || error) }, 500)
      }
    }

    // Timed-event launch broadcast — one-off push to the opt-in list only.
    // Admin-gated by the caller's own JWT (same pattern as run-crowns).
    if (url.pathname === '/api/event/launch-broadcast' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || ''

      if (!authHeader.toLowerCase().startsWith('bearer ')) {
        return json({ error: 'unauthorized' }, 401)
      }

      try {
        const adminCheck = await fetch(`${supabaseBaseUrl(env)}/rest/v1/rpc/is_current_user_admin`, {
          method: 'POST',
          headers: {
            apikey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: '{}',
        })

        const isAdmin = adminCheck.ok && (await adminCheck.json()) === true

        if (!isAdmin) {
          return json({ error: 'admin only' }, 403)
        }

        const result = await runEventLaunchBroadcast(env)
        return json(result)
      } catch (error) {
        return json({ error: String(error?.message || error) }, 500)
      }
    }

    // Anything else under /api is unknown; everything else is static assets.
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'not found' }, 404)
    }

    return env.ASSETS.fetch(request)
  },

  async scheduled(event, env, ctx) {
    // Crons (wrangler.jsonc): Monday 00:30 UTC = weekly crowns; 1st of the
    // month 00:30 UTC = monthly crowns; evening crons = streak sweep.
    if (event.cron === '30 0 * * 1') {
      ctx.waitUntil(runCrownsSweep(env, 'weekly'))
      return
    }

    if (event.cron === '30 0 1 * *') {
      ctx.waitUntil(runCrownsSweep(env, 'monthly'))
      return
    }

    ctx.waitUntil(runStreakSweep(env))
  },
}
