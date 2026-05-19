import { useQuery } from '@tanstack/react-query'
import { fetchLeaderboardSubmissions } from '../api/submissions'
import { calculateLeaderboard } from '../logic/leaderboard/calculateLeaderboard'
import { getLondonDateParts } from '../utils/dates'

export function getActivityLeaderboardQueryKey(circleId, year, activityType) {
  return ['leaderboard', activityType, circleId, year]
}

export function useActivityLeaderboard({ circleId, period, currentUserId, activityType = 'pressups' }) {
  const currentYear = getLondonDateParts(new Date()).year

  const query = useQuery({
    queryKey: getActivityLeaderboardQueryKey(circleId, currentYear, activityType),
    queryFn: () => fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType }),
    enabled: Boolean(circleId),
    staleTime: 15_000,
  })

  const rows = query.data ?? []
  const calculated = calculateLeaderboard(rows, {
    period,
    currentUserId,
  })

  return {
    ...query,
    rows: calculated.rows,
    currentUserRow: calculated.currentUserRow,
    currentYear,
  }
}
