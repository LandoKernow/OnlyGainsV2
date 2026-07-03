import { useQuery } from '@tanstack/react-query'
import {
  fetchBoardLeaderboard,
  fetchLeaderboardSubmissions,
  isMissingBoardLeaderboardRpc,
  isUnsupportedActivityTypeRpcError,
} from '../api/submissions'
import { calculateLeaderboard } from '../logic/leaderboard/calculateLeaderboard'
import { getLondonDateParts } from '../utils/dates'
import { useFallenUserIds } from './useFallenUserIds'

export function getActivityLeaderboardQueryKey(circleId, year, activityType) {
  return ['leaderboard', activityType, circleId, year]
}

// FALLEN display filter — sits at the DERIVATION layer, after the cache and
// before ranking. The query cache keeps its sacred plain-array shape with all
// rows intact (stage 1 is reversible; data is never touched); fallen warriors
// simply don't render on boards, and ranks recompute without gaps. A RISEN
// user reappears as soon as the fallen-id set refetches. Exported for tests.
export function filterFallenRows(rows, fallenIds) {
  if (!fallenIds || fallenIds.size === 0) {
    return rows
  }

  const visible = rows.filter((row) => !fallenIds.has(row.userId))

  // Pre-ranked (canonical) rows get sequential ranks reassigned so the board
  // shows no gaps; raw legacy submission rows have no rank yet (assigned
  // later by calculateLeaderboard) and pass through untouched.
  if (visible.length > 0 && Number.isFinite(visible[0]?.rank)) {
    return visible.map((row, index) => ({ ...row, rank: index + 1 }))
  }

  return visible
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

  const fallenIds = useFallenUserIds()
  // Display-layer FALLEN filter (see filterFallenRows). Cache stays untouched.
  const rawRows = filterFallenRows(query.data ?? [], fallenIds)
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
