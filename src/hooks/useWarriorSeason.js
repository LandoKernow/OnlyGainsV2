import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchLeaderboardSubmissions, fetchOwnTrainingDayKeys } from '../api/submissions'
import { ACTIVITY_TYPES } from '../utils/activityTypes'
import { getLondonDateKey, getLondonDateParts } from '../utils/dates'
import { calculateHybridStreak } from '../utils/war'
import { calculateWarriorXp, getWarriorLevel } from '../utils/xp'
import { getActivityLeaderboardQueryKey } from './useActivityLeaderboard'

const EMPTY_ROWS = []

export function getTrainingDaysQueryKey(userId, year) {
  return ['streak', 'training-days', userId, year]
}

// Season record across every discipline this year: career XP level plus the
// hybrid training streak. Reuses the exact query keys the legacy leaderboards
// already use, so the selected activity is always a cache hit and the others
// stay warm for tab switches — no duplicate fetching.
export function useWarriorSeason({ circleId, userId }) {
  const currentYear = getLondonDateParts(new Date()).year
  // Re-derive at London midnight even if no data changed (streak "today").
  const todayKey = getLondonDateKey()

  const results = useQueries({
    queries: ACTIVITY_TYPES.map((activityType) => ({
      queryKey: getActivityLeaderboardQueryKey(circleId, currentYear, activityType),
      queryFn: () => fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType }),
      enabled: Boolean(circleId) && Boolean(userId),
      staleTime: 60_000,
    })),
  })

  // Cross-board training days, so a day spent logging on another board still
  // holds the streak — exactly as the Worker's streak sweep sees it.
  const trainingDaysQuery = useQuery({
    queryKey: getTrainingDaysQueryKey(userId, currentYear),
    queryFn: () => fetchOwnTrainingDayKeys({ userId, year: currentYear }),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })

  const isLoading = results.some((result) => result.isLoading)
  // ACTIVITY_TYPES is a fixed-length registry, so this dependency list never
  // changes length between renders.
  const dataByIndex = results.map((result) => result.data ?? EMPTY_ROWS)
  const trainingDayKeys = trainingDaysQuery.data ?? EMPTY_ROWS

  const season = useMemo(() => {
    const rowsByActivity = Object.fromEntries(
      ACTIVITY_TYPES.map((activityType, index) => [activityType, dataByIndex[index]]),
    )

    return {
      level: getWarriorLevel(calculateWarriorXp(rowsByActivity, userId)),
      // Board rows carry a just-logged (optimistic) set, so the streak lights
      // up the moment the hit lands; trainingDayKeys add every other board.
      streak: calculateHybridStreak(rowsByActivity, userId, { extraDayKeys: trainingDayKeys }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, todayKey, trainingDayKeys, ...dataByIndex])

  return useMemo(
    () => ({ level: { ...season.level, isLoading }, streak: season.streak, isLoading }),
    [season, isLoading],
  )
}
