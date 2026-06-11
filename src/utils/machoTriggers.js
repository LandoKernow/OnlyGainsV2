// Trigger evaluation for the macho takeover. Pure decisions in, one earned
// moment out. All thresholds live in MACHO_TAKEOVER_CONFIG — this file only
// implements the rules, it never owns the numbers.

import { MACHO_TAKEOVER_CONFIG } from '../config/machoTakeover'
import { formatActivityValue } from './activity'
import { getActivityLabel } from './activityTypes'
import { getLondonPeriodKeys, getSubmissionPeriodKeys } from './dates'

const SEEN_KEY_PREFIX = 'only_gains_macho_seen_v1'
const LAST_TAKEOVER_KEY_PREFIX = 'only_gains_macho_last_takeover_v1'
const LAST_TOAST_KEY_PREFIX = 'only_gains_macho_last_toast_v1'

function readStorage(key) {
  try {
    return globalThis.localStorage?.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Restrictive storage: triggers degrade gracefully, never crash a log.
  }
}

function readSeenTriggers(userId) {
  try {
    const parsed = JSON.parse(readStorage(`${SEEN_KEY_PREFIX}_${userId}`) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Best single-day total for this user/activity BEFORE today, from the raw
// submission rows the dashboard already has loaded. No extra fetch.
function getBestPreviousDayTotal(rows, userId, todayKey) {
  const totalsByDay = {}

  for (const row of rows ?? []) {
    if (row.userId !== userId || row.pending || !row.activityDate) {
      continue
    }

    const dayKey = getSubmissionPeriodKeys(row.activityDate).todayKey

    if (!dayKey || dayKey === todayKey) {
      continue
    }

    totalsByDay[dayKey] = (totalsByDay[dayKey] ?? 0) + (Number(row.value) || 0)
  }

  return Math.max(0, ...Object.values(totalsByDay))
}

// Evaluates all enabled triggers against one just-logged hit and returns the
// highest-priority earned moment, or null when the log was just a log.
//
// context:
//   userId, activityType, value          — the hit
//   submissionRows                       — raw current-year rows (legacy leaderboard data)
//   previousRank, newRank                — weekly rank before/after this log
//   streakDays                           — streak INCLUDING this log
//   todayTotalBefore                     — user's total today before this log
export function evaluateMachoTrigger(context, config = MACHO_TAKEOVER_CONFIG) {
  const fired = []
  const triggers = config.triggers
  const activityLabel = getActivityLabel(context.activityType).toUpperCase()

  // --- Personal record: biggest day of this activity, ever app-tracked.
  if (triggers.personalRecord?.enabled) {
    const todayKey = getLondonPeriodKeys(new Date()).todayKey
    const bestBefore = getBestPreviousDayTotal(context.submissionRows, context.userId, todayKey)
    const todayTotal = (context.todayTotalBefore ?? 0) + context.value

    if (bestBefore > 0 && todayTotal > bestBefore) {
      fired.push({
        type: 'personalRecord',
        priority: triggers.personalRecord.priority,
        tagline: triggers.personalRecord.tagline,
        stat: formatActivityValue(todayTotal, context.activityType),
        sub: `BEST DAY EVER · ${activityLabel}`,
      })
    }
  }

  // --- Level up: this log pushed the warrior over an XP rank boundary.
  if (
    triggers.levelUp?.enabled &&
    context.newLevel &&
    context.previousLevel &&
    context.newLevel.level > context.previousLevel.level
  ) {
    fired.push({
      type: 'levelUp',
      priority: triggers.levelUp.priority,
      tagline: triggers.levelUp.tagline,
      stat: `LVL ${context.newLevel.level}`,
      sub: context.newLevel.name,
    })
  }

  // --- Streak milestone: fires the day the streak hits the configured number.
  if (triggers.streak?.enabled && triggers.streak.days.includes(context.streakDays)) {
    fired.push({
      type: 'streak',
      priority: triggers.streak.priority,
      tagline: triggers.streak.tagline,
      stat: `${context.streakDays}`,
      sub: 'DAY STREAK',
    })
  }

  // --- Rank up: this log took a spot inside the configured top N.
  if (
    triggers.rankUp?.enabled &&
    Number.isFinite(context.newRank) &&
    Number.isFinite(context.previousRank) &&
    context.newRank < context.previousRank &&
    context.newRank <= triggers.rankUp.minRank
  ) {
    fired.push({
      type: 'rankUp',
      priority: triggers.rankUp.priority,
      tagline: triggers.rankUp.tagline,
      stat: `#${context.newRank}`,
      sub: `THIS WEEK · ${activityLabel}`,
    })
  }

  // --- Big session: one log that big is a statement.
  const bigThreshold = triggers.bigSession?.thresholds?.[context.activityType]

  if (triggers.bigSession?.enabled && bigThreshold != null && context.value >= bigThreshold) {
    fired.push({
      type: 'bigSession',
      priority: triggers.bigSession.priority,
      tagline: triggers.bigSession.tagline,
      stat: `+${formatActivityValue(context.value, context.activityType)}`,
      sub: 'ONE SESSION',
    })
  }

  if (fired.length === 0) {
    return null
  }

  return fired.sort((a, b) => a.priority - b.priority)[0]
}

// Decides HOW the fired trigger presents: full-screen takeover, compact
// macho toast, or nothing (cooldown). First firing of a trigger type for
// this user = takeover; repeats = toast.
export function resolveMachoPresentation(userId, triggerType, config = MACHO_TAKEOVER_CONFIG, now = Date.now()) {
  const seen = readSeenTriggers(userId)
  const isFirstTime = !seen[triggerType]
  const lastTakeover = Number(readStorage(`${LAST_TAKEOVER_KEY_PREFIX}_${userId}`)) || 0
  const lastToast = Number(readStorage(`${LAST_TOAST_KEY_PREFIX}_${userId}`)) || 0
  const takeoverReady = now - lastTakeover >= config.cooldowns.takeoverMinutes * 60_000
  const toastReady = now - lastToast >= config.cooldowns.toastMinutes * 60_000

  if (config.firstTimeFullScreen && isFirstTime && takeoverReady) {
    return 'takeover'
  }

  if (!isFirstTime && toastReady) {
    return 'toast'
  }

  // First-time but takeover on cooldown: drop to toast rather than swallow
  // the moment entirely (it stays marked unseen, so the takeover still owes).
  if (isFirstTime && toastReady) {
    return 'toast'
  }

  return null
}

export function markMachoFired(userId, triggerType, presentation, now = Date.now()) {
  if (presentation === 'takeover') {
    const seen = readSeenTriggers(userId)
    seen[triggerType] = (seen[triggerType] ?? 0) + 1
    writeStorage(`${SEEN_KEY_PREFIX}_${userId}`, JSON.stringify(seen))
    writeStorage(`${LAST_TAKEOVER_KEY_PREFIX}_${userId}`, String(now))
    return
  }

  if (presentation === 'toast') {
    writeStorage(`${LAST_TOAST_KEY_PREFIX}_${userId}`, String(now))
  }
}
