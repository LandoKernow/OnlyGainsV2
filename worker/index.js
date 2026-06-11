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
import { getNotificationCopy } from '../src/copy/notificationTemplates.js'

// ---------------------------------------------------------------------------
// Supabase REST (service role) helpers
// ---------------------------------------------------------------------------

function sb(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

async function sbSelect(env, path) {
  const response = await sb(env, path)

  if (!response.ok) {
    throw new Error(`Supabase select failed (${response.status}): ${path}`)
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
      throw new Error(`Supabase select failed (${response.status}): ${path}`)
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
    throw new Error(`Supabase insert failed (${response.status}): ${table}`)
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
  const rows = await sbSelect(env, `notification_prefs?user_id=eq.${userId}&select=global_mute,categories`)
  const row = rows[0]

  return {
    globalMute: row?.global_mute ?? false,
    categories: { ...NOTIFICATIONS_CONFIG.defaultCategories, ...(row?.categories ?? {}) },
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

  // MILESTONE — lifetime (year) round numbers.
  const milestones = NOTIFICATIONS_CONFIG.lifetimeMilestones[activityType] ?? []
  const crossed = milestones.find(
    (mark) => actorLifetime >= mark && actorLifetime - (Number(value) || 0) < mark,
  )

  if (crossed) {
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
// HTTP surface
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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
      const auth = request.headers.get('Authorization') || ''

      if (!env.TEST_FIRE_TOKEN || auth !== `Bearer ${env.TEST_FIRE_TOKEN}`) {
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
      const auth = request.headers.get('Authorization') || ''

      if (!env.TEST_FIRE_TOKEN || auth !== `Bearer ${env.TEST_FIRE_TOKEN}`) {
        return json({ error: 'unauthorized' }, 401)
      }

      try {
        const body = await request.json()

        if (body.sweep) {
          return json(await runStreakSweep(env))
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

    // Anything else under /api is unknown; everything else is static assets.
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'not found' }, 404)
    }

    return env.ASSETS.fetch(request)
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runStreakSweep(env))
  },
}
