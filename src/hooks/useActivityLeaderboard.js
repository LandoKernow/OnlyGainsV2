import { useQuery } from '@tanstack/react-query'
import { fetchBoardLeaderboard, fetchLeaderboardSubmissions, isMissingBoardLeaderboardRpc } from '../api/submissions'
import { calculateLeaderboard } from '../logic/leaderboard/calculateLeaderboard'
import { getLondonDateParts } from '../utils/dates'

export function getActivityLeaderboardQueryKey(circleId, year, activityType) {
  return ['leaderboard', activityType, circleId, year]
}

export function useActivityLeaderboard({
  circleId,
  period,
  currentUserId,
  activityType = 'pressups',
  source = 'legacy',
}) {
  const currentYear = getLondonDateParts(new Date()).year

  const query = useQuery({
    queryKey:
      source === 'canonical'
        ? ['leaderboard', 'canonical', activityType, period, circleId, currentYear]
        : getActivityLeaderboardQueryKey(circleId, currentYear, activityType),
    queryFn: async () => {
      if (source === 'canonical') {
        try {
          return await fetchBoardLeaderboard({
            boardId: circleId,
            period,
            year: currentYear,
            activityType,
          })
        } catch (error) {
          if (!isMissingBoardLeaderboardRpc(error)) {
            throw error
          }

          if (import.meta.env.DEV) {
            console.warn('[Only Gains Board] get_board_leaderboard RPC not ready yet.')
          }
        }
      }

      return fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType })
    },
    enabled: Boolean(circleId),
    staleTime: 15_000,
  })

  const rawRows = query.data ?? []
  const calculated = source === 'canonical'
    ? {
        rows: rawRows.map((row) => ({
          ...row,
          isCurrentUser: row.userId === currentUserId,
        })),
        currentUserRow: (() => {
          const currentRow = rawRows.find((row) => row.userId === currentUserId)
          return currentRow ? { ...currentRow, isCurrentUser: true } : null
        })(),
      }
    : calculateLeaderboard(rawRows, {
        period,
        currentUserId,
      })

  return {
    ...query,
    rows: calculated.rows,
    currentUserRow: calculated.currentUserRow,
    currentYear,
    sourceMode: source,
    isCanonical: source === 'canonical',
  }
}
