import { getLondonPeriodKeys, getSubmissionPeriodKeys } from '../../utils/dates'

function createEmptyBucket(row) {
  return {
    userId: row.userId,
    actorName: row.actorName || 'Unnamed warrior',
    total: 0,
    todayTotal: 0,
    pending: false,
    lastCreatedAt: row.createdAt,
  }
}

export function calculateLeaderboard(rows, { period, currentUserId, now = new Date() }) {
  const currentKeys = getLondonPeriodKeys(now)
  const totalsByUser = new Map()

  for (const row of rows) {
    const rowKeys = getSubmissionPeriodKeys(row.activityDate || row.createdAt)

    if (rowKeys.yearKey !== currentKeys.yearKey) {
      continue
    }

    let shouldCount = false

    if (period === 'weekly') {
      shouldCount = rowKeys.weekKey === currentKeys.weekKey
    } else if (period === 'monthly') {
      shouldCount = rowKeys.monthKey === currentKeys.monthKey
    } else {
      shouldCount = rowKeys.yearKey === currentKeys.yearKey
    }

    if (!shouldCount) {
      continue
    }

    const existing = totalsByUser.get(row.userId) ?? createEmptyBucket(row)
    existing.total += Number(row.value) || 0

    if (rowKeys.todayKey === currentKeys.todayKey) {
      existing.todayTotal += Number(row.value) || 0
    }

    if (row.pending) {
      existing.pending = true
    }

    if (!existing.actorName && row.actorName) {
      existing.actorName = row.actorName
    }

    if (!existing.lastCreatedAt || new Date(row.createdAt) > new Date(existing.lastCreatedAt)) {
      existing.lastCreatedAt = row.createdAt
    }

    totalsByUser.set(row.userId, existing)
  }

  const rankedRows = [...totalsByUser.values()]
    .sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total
      }

      if (right.todayTotal !== left.todayTotal) {
        return right.todayTotal - left.todayTotal
      }

      return new Date(right.lastCreatedAt).getTime() - new Date(left.lastCreatedAt).getTime()
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      isCurrentUser: row.userId === currentUserId,
    }))

  return {
    rows: rankedRows,
    currentUserRow: rankedRows.find((row) => row.userId === currentUserId) ?? null,
  }
}
