import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSubmission, debugSubmissionPropagation } from '../api/submissions'
import { useToast } from '../components/ToastProvider'
import { getLondonSubmissionParts } from '../utils/dates'
import { getLogSuccessMessage, getToastMessage } from '../utils/toastCopy'
import { createClientId } from '../utils/uuid'
import { getPressupLeaderboardQueryKey } from './usePressupLeaderboard'
import { getRecentSubmissionsQueryKey } from './useRecentSubmissions'
import { GLOBAL_BOARD_ID } from '../utils/boards'

const CANONICAL_PROPAGATION_REFRESH_DELAYS = [350, 1400]

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

function isRecentSubmissionsQuery(query) {
  return Array.isArray(query.queryKey) && query.queryKey[0] === 'dashboard' && query.queryKey[1] === 'recent-submissions'
}

function isLeaderboardQueryForPressups(query) {
  return (
    Array.isArray(query.queryKey) &&
    query.queryKey[0] === 'leaderboard' &&
    (query.queryKey[1] === 'pressups' || query.queryKey[1] === 'canonical')
  )
}

function scheduleCanonicalPropagationRefresh({ queryClient }) {
  for (const delayMs of CANONICAL_PROPAGATION_REFRESH_DELAYS) {
    globalThis.setTimeout(() => {
      void queryClient.invalidateQueries({
        predicate: (query) => isRecentSubmissionsQuery(query),
      })

      void queryClient.invalidateQueries({
        predicate: (query) => isLeaderboardQueryForPressups(query),
      })
    }, delayMs)
  }
}

export function usePressupLogger({ circleId, userId, actorName, limit = 5, boardIds = [] }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const queryKey = getRecentSubmissionsQueryKey(circleId, limit)
  const currentYear = getLondonSubmissionParts().year
  const leaderboardQueryKey = getPressupLeaderboardQueryKey(circleId, currentYear)
  const propagationBoardIds = [...new Set([GLOBAL_BOARD_ID, circleId, ...(boardIds ?? [])].filter(Boolean))]

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

      if (import.meta.env.DEV) {
        console.debug('[Only Gains Logging] press-up payload prepared', {
          keys: Object.keys(payload),
          circle_id: payload.circle_id,
          user_id: payload.user_id,
          value: payload.value,
          unit: payload.unit,
          activity_date: payload.activity_date,
          source: payload.source,
          year: payload.year,
          month: payload.month,
        })
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
    onSuccess: async (savedSubmission, _variables, context) => {
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

      showToast({ tone: 'success', message: getLogSuccessMessage('pressups', Number(savedSubmission.value)) })

      scheduleCanonicalPropagationRefresh({ queryClient })

      if (import.meta.env.DEV) {
        globalThis.setTimeout(async () => {
          const propagation = await debugSubmissionPropagation({
            submissionId: savedSubmission.id,
            userId,
            activityType: 'pressups',
            value: savedSubmission.value,
            activityDate: savedSubmission.activityDate,
            circleId,
            boardIds: propagationBoardIds,
          })

          console.debug('[Only Gains Logging] canonical propagation', propagation)
        }, 900)
      }
    },
    onError: (error, _variables, context) => {
      console.error('[Only Gains Logging] submission failed', {
        code: error?.code ?? null,
        message: error?.message ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
        activityType: 'pressups',
        circleId,
        userId,
      })
      queryClient.setQueryData(queryKey, context?.previousRows ?? [])
      queryClient.setQueryData(leaderboardQueryKey, context?.previousLeaderboardRows ?? [])
      showToast({ tone: 'error', message: getToastMessage('log_error', error?.code) })
    },
    onSettled: () => {
      globalThis.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey })
      }, CANONICAL_PROPAGATION_REFRESH_DELAYS[0])
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKey })
    },
  })
}
