import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSubmission } from '../api/submissions'
import { useToast } from '../components/ToastProvider'
import { getLondonSubmissionParts } from '../utils/dates'
import { createClientId } from '../utils/uuid'
import { getPressupLeaderboardQueryKey } from './usePressupLeaderboard'
import { getRecentSubmissionsQueryKey } from './useRecentSubmissions'

function buildPendingSubmission({ value, circleId, userId, actorName }) {
  const dateParts = getLondonSubmissionParts()

  return {
    id: `pending-${createClientId()}`,
    circleId,
    userId,
    activityType: 'pressups',
    value,
    unit: 'reps',
    source: 'app_v2',
    activityDate: dateParts.activityDate,
    createdAt: new Date().toISOString(),
    note: '',
    actorName,
    pending: true,
  }
}

export function usePressupLogger({ circleId, userId, actorName, limit = 5 }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const queryKey = getRecentSubmissionsQueryKey(circleId, limit)
  const currentYear = getLondonSubmissionParts().year
  const leaderboardQueryKey = getPressupLeaderboardQueryKey(circleId, currentYear)

  return useMutation({
    mutationFn: async ({ value }) => {
      const createdAt = new Date().toISOString()
      const dateParts = getLondonSubmissionParts(new Date(createdAt))
      const payload = {
        id: createClientId(),
        circle_id: circleId,
        user_id: userId,
        activity_type: 'pressups',
        value,
        unit: 'reps',
        source: 'app_v2',
        activity_date: dateParts.activityDate,
        note: '',
        created_at: createdAt,
        year: dateParts.year,
        month: dateParts.month,
      }

      return createSubmission(payload)
    },
    onMutate: async ({ value }) => {
      await queryClient.cancelQueries({ queryKey })
      await queryClient.cancelQueries({ queryKey: leaderboardQueryKey })

      const pendingSubmission = buildPendingSubmission({
        value,
        circleId,
        userId,
        actorName,
      })

      const previousRows = queryClient.getQueryData(queryKey) ?? []
      const previousLeaderboardRows = queryClient.getQueryData(leaderboardQueryKey) ?? []

      queryClient.setQueryData(queryKey, [pendingSubmission, ...previousRows].slice(0, limit))
      queryClient.setQueryData(leaderboardQueryKey, [pendingSubmission, ...previousLeaderboardRows])

      return {
        pendingId: pendingSubmission.id,
        previousRows,
        previousLeaderboardRows,
      }
    },
    onSuccess: (savedSubmission, _variables, context) => {
      queryClient.setQueryData(queryKey, (currentRows = []) =>
        currentRows.map((row) =>
          row.id === context.pendingId
            ? {
                ...savedSubmission,
                actorName,
              }
            : row,
        ),
      )
      queryClient.setQueryData(leaderboardQueryKey, (currentRows = []) =>
        currentRows.map((row) =>
          row.id === context.pendingId
            ? {
                ...savedSubmission,
                actorName,
              }
            : row,
        ),
      )

      showToast({ tone: 'success', message: 'BOARD UPDATED.' })
    },
    onError: (error, _variables, context) => {
      console.error('[Only Gains Logging] submission failed', error)
      queryClient.setQueryData(queryKey, context?.previousRows ?? [])
      queryClient.setQueryData(leaderboardQueryKey, context?.previousLeaderboardRows ?? [])
      showToast({ tone: 'error', message: 'Could not save. Try again.' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKey })
    },
  })
}
