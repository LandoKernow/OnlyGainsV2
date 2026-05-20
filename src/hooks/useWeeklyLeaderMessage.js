import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchWeeklyLeaderMessage, getWeeklyLeaderMessageQueryKey, upsertWeeklyLeaderMessage } from '../api/leaderMessages'
import { getLondonPeriodKeys } from '../utils/dates'

export function useWeeklyLeaderMessage({ circleId, currentUserId, isCurrentWeeklyLeader }) {
  const currentWeekStart = getLondonPeriodKeys(new Date()).weekKey
  const queryKey = getWeeklyLeaderMessageQueryKey(circleId, currentWeekStart)
  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchWeeklyLeaderMessage({
        circleId,
        weekStart: currentWeekStart,
        activityType: 'pressups',
        periodType: 'weekly',
      }),
    enabled: Boolean(circleId),
    staleTime: 15_000,
  })

  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: async ({ message, existingId }) =>
      upsertWeeklyLeaderMessage({
        circleId,
        weekStart: currentWeekStart,
        activityType: 'pressups',
        periodType: 'weekly',
        userId: currentUserId,
        message,
        existingId,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data)
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    ...query,
    currentWeekStart,
    messageRow: query.data ?? null,
    save,
  }
}
