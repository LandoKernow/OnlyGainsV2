import { useQuery } from '@tanstack/react-query'
import { fetchPublicProfileSummary } from '../api/publicProfiles'

export function getPublicProfileSummaryQueryKey(circleId, userId, year = 2026) {
  return ['public-profile-summary', circleId, userId, year]
}

export function usePublicProfileSummary({ circleId, userId, year = 2026 }) {
  const normalizedUserId = String(userId || '').trim()
  const query = useQuery({
    queryKey: getPublicProfileSummaryQueryKey(circleId, normalizedUserId, year),
    queryFn: () => fetchPublicProfileSummary({ circleId, userId: normalizedUserId, year }),
    enabled: Boolean(circleId) && Boolean(normalizedUserId),
    staleTime: 30_000,
  })

  return {
    ...query,
    summary: query.data ?? null,
  }
}
