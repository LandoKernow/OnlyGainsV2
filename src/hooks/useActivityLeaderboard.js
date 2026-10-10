import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchBoardLeaderboard,
  fetchLeaderboardSubmissions,
  isMissingBoardLeaderboardRpc,
  isUnsupportedActivityTypeRpcError,
} from '../api/submissions'
import { calculateLeaderboard } from '../logic/leaderboard/calculateLeaderboard'
import { getLondonDateKey, getLondonDateParts } from '../utils/dates'

const EMPTY_ROWS = []

export function getActivityLeaderboardQueryKey(circleId, year, activityType) {
  return ['leaderboard', activityType, circleId, year]
}

// Canonical RPC rows arrive pre-ranked; the legacy fallback returns raw
// submissions that still need aggregating. Cache shape is a plain array in
// both cases (the contract) — distinguish by row shape, not by query state.
function deriveLeaderboard(rawRows, { source, period, currentUserId }) {
  const hasPreRankedRows = rawRows.length === 0 || Number.isFinite(rawRows[0]?.rank)

  if (source === 'canonical' && hasPreRankedRows) {
    const currentRow = rawRows.find((row) => row.userId === currentUserId)

    return {
      rows: rawRows.map((row) => ({
        ...row,
        isCurrentUser: row.userId === currentUserId,
      })),
      currentUserRow: currentRow ? { ...currentRow, isCurrentUser: true } : null,
    }
  }

  return calculateLeaderboard(rawRows, {
    period,
    currentUserId,
  })
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

  const rawRows = query.data ?? EMPTY_ROWS
  // Re-rank at London midnight even when no data changed ("today" totals and
  // the week boundary move with the clock).
  const todayKey = getLondonDateKey()
  // Ranking walks every submission of the year; only redo it when the rows,
  // the view or the day actually changes — not on every keystroke or toast.
  const calculated = useMemo(
    () => deriveLeaderboard(rawRows, { source, period, currentUserId }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawRows, source, period, currentUserId, todayKey],
  )

  return {
    ...query,
    rows: calculated.rows,
    currentUserRow: calculated.currentUserRow,
    currentYear,
    sourceMode: source,
    isCanonical: source === 'canonical',
  }
}
