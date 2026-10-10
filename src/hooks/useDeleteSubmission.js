import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteSubmissionById } from '../api/submissions'
import { useToast } from '../components/ToastProvider'
import { ACTIVITY_TYPES } from '../utils/activityTypes'
import { getLondonDateParts } from '../utils/dates'
import { getToastMessage } from '../utils/toastCopy'
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'
import { getRecentSubmissionsQueryKey } from './useRecentSubmissions'

// Every leaderboard read (legacy per-discipline and canonical) plus the
// cross-board streak days — a removed entry must leave all of them.
function isBoardDerivedQuery(query) {
  const [scope] = Array.isArray(query.queryKey) ? query.queryKey : []
  return scope === 'leaderboard' || scope === 'streak'
}

export function useDeleteSubmission({ circleId, userId, limit = 5 }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const recentQueryKey = getRecentSubmissionsQueryKey(circleId, limit)
  const currentYear = getLondonDateParts(new Date()).year
  // The entry can belong to any discipline, so optimistically drop it from
  // every discipline's board (pull-ups were previously left stale).
  const leaderboardQueryKeys = ACTIVITY_TYPES.map((activityType) =>
    getActivityLeaderboardQueryKey(circleId, currentYear, activityType),
  )

  return useMutation({
    mutationFn: ({ submissionId }) => deleteSubmissionById(submissionId, userId),
    onMutate: async ({ submissionId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: recentQueryKey }),
        ...leaderboardQueryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
      ])

      const previousRecentRows = queryClient.getQueryData(recentQueryKey) ?? []
      const previousLeaderboardRows = leaderboardQueryKeys.map((queryKey) => queryClient.getQueryData(queryKey))

      queryClient.setQueryData(recentQueryKey, (currentRows = []) =>
        currentRows.filter((row) => (row.legacySubmissionId || row.id) !== submissionId),
      )

      for (const queryKey of leaderboardQueryKeys) {
        if (queryClient.getQueryData(queryKey) !== undefined) {
          queryClient.setQueryData(queryKey, (currentRows = []) => currentRows.filter((row) => row.id !== submissionId))
        }
      }

      return {
        previousRecentRows,
        previousLeaderboardRows,
      }
    },
    onSuccess: (_data, variables) => {
      showToast({
        tone: 'success',
        message: getToastMessage('delete_success', variables.submissionId),
      })
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(recentQueryKey, context?.previousRecentRows ?? [])

      leaderboardQueryKeys.forEach((queryKey, index) => {
        const previousRows = context?.previousLeaderboardRows?.[index]

        if (previousRows !== undefined) {
          queryClient.setQueryData(queryKey, previousRows)
        }
      })

      showToast({ tone: 'error', message: getToastMessage('delete_error') })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: recentQueryKey })
      queryClient.invalidateQueries({ predicate: isBoardDerivedQuery })
    },
  })
}
