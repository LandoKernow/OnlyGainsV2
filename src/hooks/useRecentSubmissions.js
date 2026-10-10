import { useQuery } from '@tanstack/react-query'
import { fetchBoardActivityFeed } from '../api/submissions'
import { isBoardLiveDiagnosticsUser } from '../lib/diagnostics'

export function getRecentSubmissionsQueryKey(circleId, limit = 5) {
  return ['dashboard', 'recent-submissions', circleId, limit]
}

export function useRecentSubmissions(circleId, limit = 5, diagnostics = {}) {
  if (isBoardLiveDiagnosticsUser(diagnostics.userId)) {
    console.debug('[Only Gains Board Live]', 'useRecentSubmissions init', {
      selectedBoardName: diagnostics.selectedBoardName ?? null,
      selectedBoardId: diagnostics.selectedBoardId ?? null,
      boardIdPassedToHook: circleId ?? null,
      limit,
      queryKey: getRecentSubmissionsQueryKey(circleId, limit),
    })
  }

  return useQuery({
    queryKey: getRecentSubmissionsQueryKey(circleId, limit),
    queryFn: () =>
      fetchBoardActivityFeed({
        boardId: circleId,
        limit,
        diagnosticsUserId: diagnostics.userId,
        selectedBoardName: diagnostics.selectedBoardName,
      }),
    enabled: Boolean(circleId),
    staleTime: 15_000,
  })
}
