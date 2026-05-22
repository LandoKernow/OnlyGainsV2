import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSubmission } from '../api/submissions'
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
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'
import { getRecentSubmissionsQueryKey } from './useRecentSubmissions'

const PRESSUP_SUCCESS_MESSAGES = [
  'BOARD UPDATED.',
  'Pressure added.',
  'The board saw it.',
  'You moved. They noticed.',
  'Ground taken.',
  'Position defended.',
]

const KM_SUCCESS_MESSAGES = [
  'BOARD UPDATED.',
  'Distance banked.',
  'The board moved.',
  'Road work recorded.',
  'Pressure added.',
  'You moved. They noticed.',
  'Legs paid rent.',
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
          message: getSuccessMessage(activityType, Number(savedSubmission.value)),
        })
      }
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
