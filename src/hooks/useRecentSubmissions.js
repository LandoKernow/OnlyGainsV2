import { useQuery } from '@tanstack/react-query'
import { fetchRecentSubmissions } from '../api/submissions'

export function getRecentSubmissionsQueryKey(circleId, limit = 5) {
  return ['dashboard', 'recent-submissions', circleId, limit]
}

export function useRecentSubmissions(circleId, limit = 5) {
  return useQuery({
    queryKey: getRecentSubmissionsQueryKey(circleId, limit),
    queryFn: () => fetchRecentSubmissions({ circleId, limit }),
    enabled: Boolean(circleId),
    staleTime: 15_000,
  })
}
