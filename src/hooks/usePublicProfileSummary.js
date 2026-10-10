import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLeaderboardSubmissions } from '../api/submissions'
import { fetchPublicProfileSummary } from '../api/publicProfiles'
import { getLondonDateParts } from '../utils/dates'
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'

export function getPublicProfileSummaryQueryKey(circleId, userId, year = 2026) {
  return ['public-profile-summary', circleId, userId, year]
}

export function usePublicProfileSummary({ circleId, userId, year = 2026 }) {
  const queryClient = useQueryClient()
  const normalizedUserId = String(userId || '').trim()
  const boardYear = getLondonDateParts(new Date()).year

  const query = useQuery({
    queryKey: getPublicProfileSummaryQueryKey(circleId, normalizedUserId, year),
    queryFn: () =>
      fetchPublicProfileSummary({
        circleId,
        userId: normalizedUserId,
        year,
        boardYear,
        // The board's season rows are almost always already cached by the
        // dashboard / ranks — reuse them rather than pulling the whole board
        // again on every profile tap.
        loadBoardRows: (activityType) =>
          queryClient.ensureQueryData({
            queryKey: getActivityLeaderboardQueryKey(circleId, boardYear, activityType),
            queryFn: () => fetchLeaderboardSubmissions({ circleId, year: boardYear, activityType }),
          }),
      }),
    enabled: Boolean(circleId) && Boolean(normalizedUserId),
    staleTime: 30_000,
  })

  return {
    ...query,
    summary: query.data ?? null,
  }
}
