// War layer: tiers, streaks, taglines, call-outs.
// Everything here is derived client-side from data the app already loads —
// no schema changes, no new storage, stateless and recomputable.

import { getLondonPeriodKeys, getSubmissionPeriodKeys } from './dates'
import { PUBLIC_BASE_URL } from '../lib/publicUrl'

// Weekly-volume tier ladder. Recomputed from live board data every render,
// so tiers demote as aggressively as they promote — miss a week, lose the rank.
const PRESSUP_TIERS = [
  { min: 2000, name: 'IMMORTAL' },
  { min: 1000, name: 'WARLORD' },
  { min: 500, name: 'GLADIATOR' },
  { min: 250, name: 'VETERAN' },
  { min: 100, name: 'ENFORCER' },
  { min: 1, name: 'SOLDIER' },
  { min: 0, name: 'RECRUIT' },
]

// Pull-ups run at roughly a quarter of press-up volume per week.
const PULLUP_TIERS = [
  { min: 500, name: 'IMMORTAL' },
  { min: 250, name: 'WARLORD' },
  { min: 125, name: 'GLADIATOR' },
  { min: 60, name: 'VETERAN' },
  { min: 25, name: 'ENFORCER' },
  { min: 1, name: 'SOLDIER' },
  { min: 0, name: 'RECRUIT' },
]

const KM_TIERS = [
  { min: 80, name: 'IMMORTAL' },
  { min: 50, name: 'WARLORD' },
  { min: 30, name: 'GLADIATOR' },
  { min: 15, name: 'VETERAN' },
  { min: 5, name: 'ENFORCER' },
  { min: 0.01, name: 'SOLDIER' },
  { min: 0, name: 'RECRUIT' },
]

// Air squats accumulate fastest of the rep lifts — weekly volume runs high.
const SQUAT_TIERS = [
  { min: 5000, name: 'IMMORTAL' },
  { min: 2500, name: 'WARLORD' },
  { min: 1500, name: 'GLADIATOR' },
  { min: 750, name: 'VETERAN' },
  { min: 300, name: 'ENFORCER' },
  { min: 1, name: 'SOLDIER' },
  { min: 0, name: 'RECRUIT' },
]

const TIER_LADDERS = {
  pressups: PRESSUP_TIERS,
  pullups: PULLUP_TIERS,
  km: KM_TIERS,
  squats: SQUAT_TIERS,
}

export function getWarTier(weeklyTotal, activityType = 'pressups') {
  const ladder = TIER_LADDERS[activityType] ?? PRESSUP_TIERS
  const total = Number(weeklyTotal) || 0
  return (ladder.find((tier) => total >= tier.min) ?? ladder[ladder.length - 1]).name
}

const WAR_CARD_TAGLINES = [
  'TRAINED WHILE THEY SLEPT.',
  'THE BOARD SAW IT.',
  'BRING BETTER ENEMIES.',
  'PRESSURE IS A GIFT. GIVE GENEROUSLY.',
  'LOG FIRST. TALK LATER.',
  'WEAKNESS DENIED.',
  'THE BOARD REMEMBERS.',
]

export function getWarCardTagline(seed) {
  let hash = 0

  for (const char of String(seed ?? Date.now())) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }

  return WAR_CARD_TAGLINES[Math.abs(hash) % WAR_CARD_TAGLINES.length]
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Consecutive London calendar days with at least one log, walking back from
// today (or yesterday, if today is still empty — the streak is then "at risk").
// Computed from the current-year submissions the dashboard already fetches.
export function calculateStreak(rows, userId, now = new Date()) {
  const loggedDays = new Set()

  for (const row of rows ?? []) {
    if (row.userId !== userId || !row.activityDate) {
      continue
    }

    loggedDays.add(getSubmissionPeriodKeys(row.activityDate).todayKey)
  }

  const todayKey = getLondonPeriodKeys(now).todayKey
  const activeToday = loggedDays.has(todayKey)
  let cursor = activeToday ? todayKey : shiftDateKey(todayKey, -1)
  let streakDays = 0

  while (loggedDays.has(cursor)) {
    streakDays += 1
    cursor = shiftDateKey(cursor, -1)
  }

  return {
    streakDays,
    activeToday,
    // Streak exists but nothing logged today: it dies at London midnight.
    atRisk: streakDays > 0 && !activeToday,
  }
}

// Milestone line for the war card — the "insane not to post" hook.
// Crossed-threshold logic: only fires when THIS log pushed the weekly/streak
// total past a milestone, so it feels earned, not spammed.
const WEEKLY_MILESTONES_BY_ACTIVITY = {
  pressups: [
    { at: 2000, line: '2,000 THIS WEEK. THE BOARD FEARS YOU.' },
    { at: 1000, line: '1,000 THIS WEEK. TOP 0.3% TERRITORY. PROVE IT.' },
    { at: 500, line: '500 THIS WEEK. GLADIATOR CONFIRMED.' },
    { at: 250, line: '250 THIS WEEK. THEY CAN FEEL YOU NOW.' },
    { at: 100, line: 'FIRST 100 OF THE WEEK. NO HIDING NOW.' },
  ],
  pullups: [
    { at: 500, line: '500 PULL-UPS THIS WEEK. THE BAR SURRENDERED.' },
    { at: 250, line: '250 THIS WEEK. GRAVITY FILED A COMPLAINT.' },
    { at: 125, line: '125 THIS WEEK. GLADIATOR ON THE BAR.' },
    { at: 60, line: '60 THIS WEEK. THEY CAN FEEL YOU NOW.' },
    { at: 25, line: 'FIRST 25 OF THE WEEK. THE BAR KNOWS YOUR NAME.' },
  ],
  km: [
    { at: 80, line: '80 KM THIS WEEK. THE ROAD FEARS YOU.' },
    { at: 50, line: '50 KM THIS WEEK. WARLORD DISTANCE.' },
    { at: 30, line: '30 KM THIS WEEK. GLADIATOR CONFIRMED.' },
    { at: 15, line: '15 KM THIS WEEK. THEY CAN HEAR YOU COMING.' },
    { at: 5, line: 'FIRST 5 KM OF THE WEEK. NO HIDING NOW.' },
  ],
}

const STREAK_MILESTONES = [
  { at: 100, line: '100 DAY STREAK. INHUMAN.' },
  { at: 30, line: '30 DAYS UNBROKEN. DISCIPLINE MADE PUBLIC.' },
  { at: 7, line: '7 DAY STREAK. THE WEAK QUIT BY NOW.' },
]

export function getMilestone({ previousWeeklyTotal, weeklyTotal, streakDays, activityType = 'pressups' }) {
  const weeklyMilestones = WEEKLY_MILESTONES_BY_ACTIVITY[activityType] ?? WEEKLY_MILESTONES_BY_ACTIVITY.pressups

  for (const milestone of weeklyMilestones) {
    if (weeklyTotal >= milestone.at && (previousWeeklyTotal ?? 0) < milestone.at) {
      return milestone.line
    }
  }

  for (const milestone of STREAK_MILESTONES) {
    if (streakDays === milestone.at) {
      return milestone.line
    }
  }

  return ''
}

// Kill-streak combo: consecutive London days (ending today) where the day's
// total hit the heavy threshold. ×2 and up earns the badge — one heavy day
// is a session, two in a row is a warpath.
const COMBO_THRESHOLDS = {
  pressups: 100,
  pullups: 25,
  km: 8,
}

export function calculateCombo(rows, userId, activityType = 'pressups', now = new Date()) {
  const threshold = COMBO_THRESHOLDS[activityType] ?? COMBO_THRESHOLDS.pressups
  const totalsByDay = {}

  for (const row of rows ?? []) {
    if (row.userId !== userId || !row.activityDate) {
      continue
    }

    const dayKey = getSubmissionPeriodKeys(row.activityDate).todayKey
    totalsByDay[dayKey] = (totalsByDay[dayKey] ?? 0) + (Number(row.value) || 0)
  }

  const todayKey = getLondonPeriodKeys(now).todayKey
  let cursor = (totalsByDay[todayKey] ?? 0) >= threshold ? todayKey : shiftDateKey(todayKey, -1)
  let combo = 0

  while ((totalsByDay[cursor] ?? 0) >= threshold) {
    combo += 1
    cursor = shiftDateKey(cursor, -1)
  }

  return combo
}

const CALLOUT_LINES = [
  'Enjoy the view while it lasts.',
  "I'm closing. You're coasting.",
  'Hold that spot. If you can.',
]

export function buildCalloutText({ rivalName, gapLabel }) {
  const line = CALLOUT_LINES[Math.floor(Math.random() * CALLOUT_LINES.length)]
  const opener = rivalName ? `${rivalName}.` : 'You.'
  const gap = gapLabel ? ` I'm ${gapLabel} behind you on Only Gains.` : ' I see your name above mine on Only Gains.'

  return `${opener}${gap} ${line}`
}

export async function shareCallout({ rivalName, gapLabel }) {
  const text = buildCalloutText({ rivalName, gapLabel })
  const url = PUBLIC_BASE_URL

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Only Gains', text, url })
      return 'shared'
    } catch (error) {
      if (error?.name === 'AbortError') {
        return 'cancelled'
      }

      throw error
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  }

  return 'unavailable'
}
