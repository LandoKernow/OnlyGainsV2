import { useQueries } from '@tanstack/react-query'
import { fetchLeaderboardSubmissions } from '../api/submissions'
import { ACTIVITY_TYPES } from '../utils/activityTypes'
import { getLondonDateParts } from '../utils/dates'
import { calculateWarriorXp, getWarriorLevel } from '../utils/xp'
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'

// Career XP across every activity this year. Reuses the exact query keys the
// legacy leaderboards already use, so the selected activity is always a cache
// hit and the others stay warm for tab switches — no duplicate fetching.
export function useWarriorXp({ circleId, userId }) {
  const currentYear = getLondonDateParts(new Date()).year

  const results = useQueries({
    queries: ACTIVITY_TYPES.map((activityType) => ({
      queryKey: getActivityLeaderboardQueryKey(circleId, currentYear, activityType),
      queryFn: () => fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType }),
      enabled: Boolean(circleId) && Boolean(userId),
      staleTime: 60_000,
    })),
  })

  const rowsByActivity = Object.fromEntries(
    ACTIVITY_TYPES.map((activityType, index) => [activityType, results[index].data ?? []]),
  )

  const xp = calculateWarriorXp(rowsByActivity, userId)

  return {
    ...getWarriorLevel(xp),
    isLoading: results.some((result) => result.isLoading),
  }
}
