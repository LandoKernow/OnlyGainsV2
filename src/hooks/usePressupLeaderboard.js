import { useQuery } from '@tanstack/react-query'
import { fetchPressupLeaderboardSubmissions } from '../api/submissions'
import { calculateLeaderboard } from '../logic/leaderboard/calculateLeaderboard'
import { getLondonDateParts } from '../utils/dates'

export function getPressupLeaderboardQueryKey(circleId, year) {
  return ['leaderboard', 'pressups', circleId, year]
}

export function usePressupLeaderboard({ circleId, period, currentUserId }) {
  const currentYear = getLondonDateParts(new Date()).year

  const query = useQuery({
    queryKey: getPressupLeaderboardQueryKey(circleId, currentYear),
    queryFn: () => fetchPressupLeaderboardSubmissions({ circleId, year: currentYear }),
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
