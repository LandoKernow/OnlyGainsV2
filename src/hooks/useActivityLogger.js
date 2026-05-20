import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSubmission } from '../api/submissions'
import { useToast } from '../components/ToastProvider'
import { getLondonSubmissionParts } from '../utils/dates'
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'
import { getRecentSubmissionsQueryKey } from './useRecentSubmissions'

const PRESSUP_SUCCESS_MESSAGES = [
  'Reps logged.',
  'The board saw it.',
  'Pressure added.',
  'Another set on record.',
  'Work made public.',
  'Position defended.',
  'You moved. They noticed.',
]

const KM_SUCCESS_MESSAGES = [
  'KM logged.',
  'Engine checked.',
  'Distance banked.',
  'Road work recorded.',
  'Pace filed.',
  'Legs paid rent.',
  'The board moved.',
]

function getStableIndex(seed, length) {
  let hash = 0
  const value = String(seed)

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }

  return Math.abs(hash) % length
}

function getSuccessMessage(activityType, value) {
  const list = activityType === 'km' ? KM_SUCCESS_MESSAGES : PRESSUP_SUCCESS_MESSAGES
  const index = value != null ? getStableIndex(value, list.length) : getStableIndex(activityType, list.length)
  return list[index]
}

function buildPendingSubmission({ value, circleId, userId, actorName, activityType }) {
  const dateParts = getLondonSubmissionParts()

  return {
    id: `pending-${crypto.randomUUID()}`,
    circleId,
    userId,
    activityType: activityType === 'km' ? 'km' : 'pressups',
    value,
    unit: activityType === 'km' ? 'km' : 'reps',
    source: 'app_v2',
    activityDate: dateParts.activityDate,
    createdAt: new Date().toISOString(),
    note: '',
    actorName,
    pending: true,
  }
}

export function useActivityLogger({ circleId, userId, actorName, activityType = 'pressups', limit = 5 }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const queryKey = getRecentSubmissionsQueryKey(circleId, limit)
  const currentYear = getLondonSubmissionParts().year
  const leaderboardQueryKey = getActivityLeaderboardQueryKey(circleId, currentYear, activityType)

  return useMutation({
    mutationFn: async ({ value }) => {
      const createdAt = new Date().toISOString()
      const dateParts = getLondonSubmissionParts(new Date(createdAt))
      const payload = {
        id: crypto.randomUUID(),
        circle_id: circleId,
        user_id: userId,
        activity_type: activityType === 'km' ? 'km' : 'pressups',
        value,
        unit: activityType === 'km' ? 'km' : 'reps',
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
        activityType,
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

      showToast({
        tone: 'success',
        message: getSuccessMessage(activityType, Number(savedSubmission.value)),
      })
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
