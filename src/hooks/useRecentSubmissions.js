import { useQuery } from '@tanstack/react-query'
import { fetchBoardActivityFeed } from '../api/submissions'

const BOARD_LIVE_DIAGNOSTICS_USER_ID = '69e4c6a4-9d17-41bd-a3d3-245205e9c9fb'

function canLogBoardLiveDiagnostics(userId) {
  if (import.meta.env.DEV) {
    return true
  }

  return String(userId || '').trim() === BOARD_LIVE_DIAGNOSTICS_USER_ID
}

export function getRecentSubmissionsQueryKey(circleId, limit = 5) {
  return ['dashboard', 'recent-submissions', circleId, limit]
}

export function useRecentSubmissions(circleId, limit = 5, diagnostics = {}) {
  if (canLogBoardLiveDiagnostics(diagnostics.userId)) {
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
