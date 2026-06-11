// War layer: tiers, streaks, taglines, call-outs.
// Everything here is derived client-side from data the app already loads —
// no schema changes, no new storage, stateless and recomputable.

import { getLondonPeriodKeys, getSubmissionPeriodKeys } from './dates'

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

const KM_TIERS = [
  { min: 80, name: 'IMMORTAL' },
  { min: 50, name: 'WARLORD' },
  { min: 30, name: 'GLADIATOR' },
  { min: 15, name: 'VETERAN' },
  { min: 5, name: 'ENFORCER' },
  { min: 0.01, name: 'SOLDIER' },
  { min: 0, name: 'RECRUIT' },
]

export function getWarTier(weeklyTotal, activityType = 'pressups') {
  const ladder = activityType === 'km' ? KM_TIERS : PRESSUP_TIERS
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
const WEEKLY_MILESTONES = [
  { at: 2000, line: '2,000 THIS WEEK. THE BOARD FEARS YOU.' },
  { at: 1000, line: '1,000 THIS WEEK. TOP 0.3% TERRITORY. PROVE IT.' },
  { at: 500, line: '500 THIS WEEK. GLADIATOR CONFIRMED.' },
  { at: 250, line: '250 THIS WEEK. THEY CAN FEEL YOU NOW.' },
  { at: 100, line: 'FIRST 100 OF THE WEEK. NO HIDING NOW.' },
]

const STREAK_MILESTONES = [
  { at: 100, line: '100 DAY STREAK. INHUMAN.' },
  { at: 30, line: '30 DAYS UNBROKEN. DISCIPLINE MADE PUBLIC.' },
  { at: 7, line: '7 DAY STREAK. THE WEAK QUIT BY NOW.' },
]

export function getMilestone({ previousWeeklyTotal, weeklyTotal, streakDays }) {
  for (const milestone of WEEKLY_MILESTONES) {
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
  const url = 'https://onlygains.club'

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
