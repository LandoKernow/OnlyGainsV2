import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSubmission, debugSubmissionPropagation } from '../api/submissions'
import { useToast } from '../components/ToastProvider'
import { calculateLeaderboard } from '../logic/leaderboard/calculateLeaderboard'
import { getLondonPeriodKeys, getLondonSubmissionParts, getSubmissionPeriodKeys } from '../utils/dates'
import {
  buildCrownTakenToast,
  buildVaultRecordToast,
  findTopVaultGroup,
  hasSeenAchievementToast,
  markAchievementToastSeen,
} from '../utils/machoToasts'
import { createClientId } from '../utils/uuid'
import { getLogSuccessMessage, getToastMessage } from '../utils/toastCopy'
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'
import { getRecentSubmissionsQueryKey } from './useRecentSubmissions'
import { GLOBAL_BOARD_ID } from '../utils/boards'

const CANONICAL_PROPAGATION_REFRESH_DELAYS = [350, 1400]

function buildPendingSubmission({ value, circleId, userId, actorName, activityType }) {
  const dateParts = getLondonSubmissionParts()

  return {
    id: `pending-${createClientId()}`,
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

function getCrownEvent(previousRows, currentRows, { userId, activityType }) {
  const previousWeekly = calculateLeaderboard(previousRows, { period: 'weekly', currentUserId: userId })
  const currentWeekly = calculateLeaderboard(currentRows, { period: 'weekly', currentUserId: userId })

  if (currentWeekly.currentUserRow?.rank !== 1 || previousWeekly.currentUserRow?.rank === 1) {
    return null
  }

  const weekKey = getLondonPeriodKeys(new Date()).weekKey

  return {
    key: `crown_taken:${activityType}:weekly:${weekKey}:${currentWeekly.currentUserRow.total}`,
    toast: buildCrownTakenToast({ activityType }),
  }
}

function getVaultRecordEvent(previousRows, currentRows, { userId, activityType }) {
  const previousDay = findTopVaultGroup(previousRows, 'todayKey')
  const currentDay = findTopVaultGroup(currentRows, 'todayKey')
  const previousWeek = findTopVaultGroup(previousRows, 'weekKey')
  const currentWeek = findTopVaultGroup(currentRows, 'weekKey')

  if (
    currentDay?.userId === userId &&
    (!previousDay || previousDay.userId !== userId || currentDay.value > previousDay.value || currentDay.period !== previousDay.period)
  ) {
    return {
      key: `vault_record_taken:${activityType}:day:${currentDay.period}:${currentDay.value}`,
      toast: buildVaultRecordToast({ activityType, periodType: 'day' }),
    }
  }

  if (
    currentWeek?.userId === userId &&
    (!previousWeek || previousWeek.userId !== userId || currentWeek.value > previousWeek.value || currentWeek.period !== previousWeek.period)
  ) {
    return {
      key: `vault_record_taken:${activityType}:week:${currentWeek.period}:${currentWeek.value}`,
      toast: buildVaultRecordToast({ activityType, periodType: 'week' }),
    }
  }

  return null
}

function maybeShowAchievementToast({ previousRows, currentRows, userId, activityType, showToast }) {
  const event =
    getCrownEvent(previousRows, currentRows, { userId, activityType }) ??
    getVaultRecordEvent(previousRows, currentRows, { userId, activityType })

  if (!event || hasSeenAchievementToast(userId, event.key)) {
    return false
  }

  markAchievementToastSeen(userId, event.key)
  showToast(event.toast)
  return true
}

function isRecentSubmissionsQuery(query) {
  return Array.isArray(query.queryKey) && query.queryKey[0] === 'dashboard' && query.queryKey[1] === 'recent-submissions'
}

function isLeaderboardQueryForActivity(query, activityType) {
  return (
    Array.isArray(query.queryKey) &&
    query.queryKey[0] === 'leaderboard' &&
    (query.queryKey[1] === activityType || query.queryKey[1] === 'canonical')
  )
}

function scheduleCanonicalPropagationRefresh({ queryClient, activityType }) {
  for (const delayMs of CANONICAL_PROPAGATION_REFRESH_DELAYS) {
    globalThis.setTimeout(() => {
      void queryClient.invalidateQueries({
        predicate: (query) => isRecentSubmissionsQuery(query),
      })

      void queryClient.invalidateQueries({
        predicate: (query) => isLeaderboardQueryForActivity(query, activityType),
      })
    }, delayMs)
  }
}

export function useActivityLogger({ circleId, userId, actorName, activityType = 'pressups', limit = 5, boardIds = [] }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const queryKey = getRecentSubmissionsQueryKey(circleId, limit)
  const currentYear = getLondonSubmissionParts().year
  const leaderboardQueryKey = getActivityLeaderboardQueryKey(circleId, currentYear, activityType)
  const propagationBoardIds = [...new Set([GLOBAL_BOARD_ID, circleId, ...(boardIds ?? [])].filter(Boolean))]

  return useMutation({
    mutationFn: async ({ value }) => {
      const createdAt = new Date().toISOString()
      const dateParts = getLondonSubmissionParts(new Date(createdAt))
      const payload = {
        id: createClientId(),
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

      if (import.meta.env.DEV) {
        console.debug('[Only Gains Logging] mutation payload prepared', {
          activityType,
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
    onSuccess: async (savedSubmission, _variables, context) => {
      let nextLeaderboardRows = []

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
      queryClient.setQueryData(leaderboardQueryKey, (currentRows = []) => {
        nextLeaderboardRows = currentRows.map((row) =>
          row.id === context.pendingId
            ? {
                ...savedSubmission,
                actorName,
              }
            : row,
        )

        return nextLeaderboardRows
      })

      const didShowAchievementToast = maybeShowAchievementToast({
        previousRows: context?.previousLeaderboardRows ?? [],
        currentRows: nextLeaderboardRows,
        userId,
        activityType,
        showToast,
      })

      if (!didShowAchievementToast) {
        showToast({
          tone: 'success',
          message: getLogSuccessMessage(activityType, Number(savedSubmission.value)),
        })
      }

      scheduleCanonicalPropagationRefresh({
        queryClient,
        activityType,
      })

      if (import.meta.env.DEV) {
        globalThis.setTimeout(async () => {
          const propagation = await debugSubmissionPropagation({
            submissionId: savedSubmission.id,
            userId,
            activityType,
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
        activityType,
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
