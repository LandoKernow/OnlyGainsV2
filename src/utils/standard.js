// THE STANDARD — pure derivation of every warrior's progress toward the
// monthly press-up minimum. No storage, recomputable from board rows.

import { STANDARD_CONFIG } from '../config/standard'
import { getLondonDateParts } from './dates'

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]

// Where the London month stands: today's day number, month length, and the
// pace lines — what a warrior should have banked by the end of yesterday
// (status is judged against this, so nobody is "behind" at 7am) and by the end
// of today (the line to clear before midnight).
export function getStandardCalendar(now = new Date(), target = STANDARD_CONFIG.target) {
  const { year, month, day } = getLondonDateParts(now)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return {
    year,
    month,
    day,
    daysInMonth,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    monthName: MONTH_NAMES[month - 1],
    // Days still to train, today included.
    daysLeft: daysInMonth - day + 1,
    paceThroughYesterday: Math.ceil((target * (day - 1)) / daysInMonth),
    paceThroughToday: Math.ceil((target * day) / daysInMonth),
  }
}

export function getStandardStatus(total, calendar, target = STANDARD_CONFIG.target) {
  if (total >= target) {
    return 'MET'
  }

  if (total <= 0) {
    return 'SILENT'
  }

  return total >= calendar.paceThroughYesterday ? 'ON PACE' : 'BEHIND'
}

function buildEntry(row, calendar, target) {
  const total = Math.max(0, Math.round(Number(row.total) || 0))
  const remaining = Math.max(target - total, 0)

  return {
    userId: row.userId,
    actorName: row.actorName || 'Unnamed warrior',
    total,
    remaining,
    progress: Math.min(total / target, 1),
    surplus: Math.max(total - target, 0),
    status: getStandardStatus(total, calendar, target),
    // Reps a day from today to finish on time.
    perDay: remaining > 0 ? Math.ceil(remaining / calendar.daysLeft) : 0,
    // Reps still needed today to be level with the pace line at midnight.
    todayToPace: Math.max(calendar.paceThroughToday - total, 0),
  }
}

// monthlyRows — ranked board rows for THIS month ({ userId, actorName, total })
// rosterRows  — anyone else who belongs on the roll call (e.g. everyone who
//               has logged on this board this season), shown as SILENT at 0
// ownTotal    — the viewer's own month total from an optimistic source; the
//               higher of this and their board row wins, so a fresh log moves
//               the bar instantly
export function calculateMonthlyStandard({
  monthlyRows = [],
  rosterRows = [],
  userId = null,
  ownTotal = 0,
  now = new Date(),
  target = STANDARD_CONFIG.target,
} = {}) {
  const calendar = getStandardCalendar(now, target)
  const byUser = new Map()

  for (const row of monthlyRows) {
    if (row?.userId && !byUser.has(row.userId)) {
      byUser.set(row.userId, { userId: row.userId, actorName: row.actorName, total: Number(row.total) || 0 })
    }
  }

  for (const row of rosterRows) {
    if (row?.userId && !byUser.has(row.userId)) {
      byUser.set(row.userId, { userId: row.userId, actorName: row.actorName, total: 0 })
    } else if (row?.userId && !byUser.get(row.userId).actorName && row.actorName) {
      byUser.get(row.userId).actorName = row.actorName
    }
  }

  if (userId) {
    const mine = byUser.get(userId) ?? { userId, actorName: '', total: 0 }
    mine.total = Math.max(Number(mine.total) || 0, Number(ownTotal) || 0)
    byUser.set(userId, mine)
  }

  const rollCall = [...byUser.values()]
    .map((row) => buildEntry(row, calendar, target))
    .sort((left, right) => right.total - left.total || left.actorName.localeCompare(right.actorName))
    .map((entry, index) => ({ ...entry, position: index + 1, isCurrentUser: entry.userId === userId }))

  const counts = { MET: 0, 'ON PACE': 0, BEHIND: 0, SILENT: 0 }

  for (const entry of rollCall) {
    counts[entry.status] += 1
  }

  return {
    target,
    calendar,
    rollCall,
    counts,
    me: rollCall.find((entry) => entry.isCurrentUser) ?? null,
  }
}

// Banner line for the log that pushed this month's total across a mark.
export function getStandardMilestone(previousTotal, nextTotal, milestones = STANDARD_CONFIG.milestones) {
  for (const milestone of milestones) {
    if (nextTotal >= milestone.at && (previousTotal ?? 0) < milestone.at) {
      return milestone.line
    }
  }

  return ''
}

export function crossesStandard(previousTotal, nextTotal, target = STANDARD_CONFIG.target) {
  return nextTotal >= target && (previousTotal ?? 0) < target
}
