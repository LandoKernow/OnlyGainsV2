import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteSubmissionById } from '../api/submissions'
import { useToast } from '../components/ToastProvider'
import { getLondonDateParts } from '../utils/dates'
import { getPressupLeaderboardQueryKey } from './usePressupLeaderboard'
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'
import { getRecentSubmissionsQueryKey } from './useRecentSubmissions'

export function useDeleteSubmission({ circleId, userId, limit = 5 }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const recentQueryKey = getRecentSubmissionsQueryKey(circleId, limit)
  const currentYear = getLondonDateParts(new Date()).year
  const leaderboardQueryKey = getPressupLeaderboardQueryKey(circleId, currentYear)
  const leaderboardQueryKeyKm = getActivityLeaderboardQueryKey(circleId, currentYear, 'km')

  return useMutation({
    mutationFn: ({ submissionId }) => deleteSubmissionById(submissionId, userId),
    onMutate: async ({ submissionId }) => {
      await queryClient.cancelQueries({ queryKey: recentQueryKey })
      await queryClient.cancelQueries({ queryKey: leaderboardQueryKey })
      await queryClient.cancelQueries({ queryKey: leaderboardQueryKeyKm })

      const previousRecentRows = queryClient.getQueryData(recentQueryKey) ?? []
      const previousLeaderboardRows = queryClient.getQueryData(leaderboardQueryKey) ?? []
      const previousLeaderboardRowsKm = queryClient.getQueryData(leaderboardQueryKeyKm) ?? []

      queryClient.setQueryData(recentQueryKey, (currentRows = []) =>
        currentRows.filter((row) => row.id !== submissionId),
      )
      queryClient.setQueryData(leaderboardQueryKey, (currentRows = []) => currentRows.filter((row) => row.id !== submissionId))
      queryClient.setQueryData(leaderboardQueryKeyKm, (currentRows = []) => currentRows.filter((row) => row.id !== submissionId))

      return {
        previousRecentRows,
        previousLeaderboardRows,
        previousLeaderboardRowsKm,
      }
    },
    onSuccess: () => {
      showToast({ tone: 'success', message: 'Entry removed.' })
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(recentQueryKey, context?.previousRecentRows ?? [])
      queryClient.setQueryData(leaderboardQueryKey, context?.previousLeaderboardRows ?? [])
      queryClient.setQueryData(leaderboardQueryKeyKm, context?.previousLeaderboardRowsKm ?? [])
      showToast({ tone: 'error', message: 'Could not remove entry.' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: recentQueryKey })
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKey })
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKeyKm })
    },
  })
}
