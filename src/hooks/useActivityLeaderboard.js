import { useQuery } from '@tanstack/react-query'
import {
  fetchBoardLeaderboard,
  fetchLeaderboardSubmissions,
  isMissingBoardLeaderboardRpc,
  isUnsupportedActivityTypeRpcError,
} from '../api/submissions'
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
          if (!isMissingBoardLeaderboardRpc(error) && !isUnsupportedActivityTypeRpcError(error)) {
            throw error
          }

          if (import.meta.env.DEV) {
            console.warn(
              `[Only Gains Board] get_board_leaderboard RPC not ready for '${activityType}'. Using legacy submissions path.`,
            )
          }
        }
      }

      return fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType })
    },
    enabled: Boolean(circleId),
    staleTime: 15_000,
  })

  const rawRows = query.data ?? []
  // Canonical RPC rows arrive pre-ranked; the legacy fallback returns raw
  // submissions that still need aggregating. Cache shape is a plain array in
  // both cases (the contract) — distinguish by row shape, not by query state.
  const hasPreRankedRows = rawRows.length === 0 || Number.isFinite(rawRows[0]?.rank)
  const calculated = source === 'canonical' && hasPreRankedRows
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
