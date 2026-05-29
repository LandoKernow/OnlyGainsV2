import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteSubmissionById } from '../api/submissions'
import { useToast } from '../components/ToastProvider'
import { getLondonDateParts } from '../utils/dates'
import { getPressupLeaderboardQueryKey } from './usePressupLeaderboard'
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'
import { getRecentSubmissionsQueryKey } from './useRecentSubmissions'

const DELETE_SUCCESS_MESSAGES = ['Entry removed.', 'Record cleaned.', 'Log removed.']

function getStableIndex(seed, length) {
  let hash = 0

  for (const char of String(seed)) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }

  return Math.abs(hash) % length
}

function getDeleteSuccessMessage(submissionId) {
  const index = getStableIndex(submissionId ?? '', DELETE_SUCCESS_MESSAGES.length)
  return DELETE_SUCCESS_MESSAGES[index]
}

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
        currentRows.filter((row) => (row.legacySubmissionId || row.id) !== submissionId),
      )
      queryClient.setQueryData(leaderboardQueryKey, (currentRows = []) => currentRows.filter((row) => row.id !== submissionId))
      queryClient.setQueryData(leaderboardQueryKeyKm, (currentRows = []) => currentRows.filter((row) => row.id !== submissionId))

      return {
        previousRecentRows,
        previousLeaderboardRows,
        previousLeaderboardRowsKm,
      }
    },
    onSuccess: (_data, variables) => {
      showToast({
        tone: 'success',
        message: getDeleteSuccessMessage(variables.submissionId),
      })
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
