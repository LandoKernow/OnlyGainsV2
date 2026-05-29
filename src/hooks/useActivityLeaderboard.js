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
          const rows = await fetchBoardLeaderboard({
            boardId: circleId,
            period,
            year: currentYear,
            activityType,
          })

          return {
            mode: 'canonical',
            rows,
          }
        } catch (error) {
          if (!isMissingBoardLeaderboardRpc(error)) {
            throw error
          }

          if (import.meta.env.DEV) {
            console.warn('[Only Gains Board] get_board_leaderboard RPC not ready yet.')
          }
        }
      }

      const rows = await fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType })

      return {
        mode: source === 'canonical' ? 'legacy-fallback' : 'legacy',
        rows,
      }
    },
    enabled: Boolean(circleId),
    staleTime: 15_000,
  })

  const queryMode = query.data?.mode ?? 'legacy'
  const rawRows = query.data?.rows ?? []
  const calculated = queryMode === 'canonical'
    ? {
        rows: rawRows.map((row) => ({
          ...row,
          isCurrentUser: row.userId === currentUserId,
        })),
        currentUserRow: rawRows.find((row) => row.userId === currentUserId)
          ? {
              ...rawRows.find((row) => row.userId === currentUserId),
              isCurrentUser: true,
            }
          : null,
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
    sourceMode: queryMode,
    isCanonical: queryMode === 'canonical',
  }
}
