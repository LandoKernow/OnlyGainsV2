import { useMemo } from 'react'
import { STANDARD_CONFIG } from '../config/standard'
import { getLondonDateKey } from '../utils/dates'
import { calculateMonthlyStandard } from '../utils/standard'
import { useActivityLeaderboard } from './useActivityLeaderboard'

// THE STANDARD for the active board: every warrior's press-ups this month
// against the 2,000 minimum.
//   - Month totals come from the canonical board leaderboard (the same numbers
//     Ranks shows for "Monthly").
//   - The season rows (same cache the dashboard already holds) add everyone
//     who has trained on this board this year, so the silent ones still show,
//     and carry the just-logged optimistic set so your own bar moves instantly.
export function useMonthlyStandard({ circleId, userId }) {
  const activityType = STANDARD_CONFIG.activityType
  const monthly = useActivityLeaderboard({
    circleId,
    period: 'monthly',
    currentUserId: userId,
    activityType,
    source: 'canonical',
  })
  const season = useActivityLeaderboard({
    circleId,
    period: 'monthly',
    currentUserId: userId,
    activityType,
  })
  const todayKey = getLondonDateKey()
  const seasonRows = season.data
  const ownMonthTotal = season.currentUserRow?.total ?? 0

  const standard = useMemo(() => {
    const rosterByUser = new Map()

    for (const row of seasonRows ?? []) {
      if (row.userId && !rosterByUser.has(row.userId)) {
        rosterByUser.set(row.userId, { userId: row.userId, actorName: row.actorName })
      }
    }

    return calculateMonthlyStandard({
      monthlyRows: monthly.rows,
      rosterRows: [...rosterByUser.values()],
      userId,
      ownTotal: ownMonthTotal,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly.rows, seasonRows, userId, ownMonthTotal, todayKey])

  return {
    ...standard,
    isLoading: monthly.isLoading && season.isLoading,
  }
}
