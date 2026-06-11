import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLeaderboardSubmissions } from '../api/submissions'
import { useAuth } from '../features/auth/AuthProvider'
import { useBoardMeta } from './useBoardMeta'
import { useProfileYearSetup } from './useProfileYearSetup'
import { getLondonDateParts } from '../utils/dates'
import { aggregateEligibleSubmissionsByDay, aggregateEligibleSubmissionsByWeek } from '../utils/recordAggregation'

const APP_TRACKED_RECORD_TYPES = new Set([
  'pressups_day',
  'pressups_week',
  'pullups_day',
  'pullups_week',
  'km_day',
  'km_week',
])
const LOWER_IS_BETTER_RECORD_TYPES = new Set(['fastest_5k', 'fastest_10k', 'half_marathon', 'marathon'])

function createHistoryEntry({
  recordType,
  unit,
  valueNumeric = null,
  valueSeconds = null,
  sourceLabel,
  year,
  sourceType,
  sourceId,
  note = '',
}) {
  return {
    recordType,
    unit,
    valueNumeric,
    valueSeconds,
    sourceLabel,
    year,
    sourceType,
    sourceId,
    note,
  }
}

function compareRecordEntries(a, b) {
  const lowerIsBetter = LOWER_IS_BETTER_RECORD_TYPES.has(a.recordType)
  const aValue = lowerIsBetter ? Number(a.valueSeconds ?? 0) : Number(a.valueNumeric ?? 0)
  const bValue = lowerIsBetter ? Number(b.valueSeconds ?? 0) : Number(b.valueNumeric ?? 0)

  if (aValue !== bValue) {
    return lowerIsBetter ? aValue - bValue : bValue - aValue
  }

  return String(b.sourceLabel).localeCompare(String(a.sourceLabel))
}

export function usePersonalRecords(year = 2026) {
  const { session, status } = useAuth()
  const { circleId } = useBoardMeta()
  const profileYearSetup = useProfileYearSetup(year)
  const userId = session?.user?.id ?? ''
  const currentYear = getLondonDateParts(new Date()).year
  const isEnabled = status === 'authenticated' && Boolean(userId) && Boolean(circleId)

  const pressupsQuery = useQuery({
    queryKey: ['personal-records', 'submissions', circleId, currentYear, 'pressups'],
    queryFn: () => fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType: 'pressups' }),
    enabled: isEnabled,
    staleTime: 30_000,
  })

  const pullupsQuery = useQuery({
    queryKey: ['personal-records', 'submissions', circleId, currentYear, 'pullups'],
    queryFn: () => fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType: 'pullups' }),
    enabled: isEnabled,
    staleTime: 30_000,
  })

  const kmQuery = useQuery({
    queryKey: ['personal-records', 'submissions', circleId, currentYear, 'km'],
    queryFn: () => fetchLeaderboardSubmissions({ circleId, year: currentYear, activityType: 'km' }),
    enabled: isEnabled,
    staleTime: 30_000,
  })

  const recordsByType = useMemo(() => {
    const claimedEntries = profileYearSetup.recordEntries.map((entry) =>
      createHistoryEntry({
        recordType: entry.recordType,
        unit: entry.unit,
        valueNumeric: entry.valueNumeric,
        valueSeconds: entry.valueSeconds,
        sourceLabel: entry.sourceLabel,
        year: entry.year,
        sourceType: 'profile_record_entry',
        sourceId: entry.id,
      }),
    )

    const ownPressupsRows = (pressupsQuery.data ?? []).filter((row) => row.userId === userId)
    const ownPullupsRows = (pullupsQuery.data ?? []).filter((row) => row.userId === userId)
    const ownKmRows = (kmQuery.data ?? []).filter((row) => row.userId === userId)

    const appTrackedEntries = [
      ...aggregateEligibleSubmissionsByDay(ownPressupsRows, 'pressups'),
      ...aggregateEligibleSubmissionsByWeek(ownPressupsRows, 'pressups'),
      ...aggregateEligibleSubmissionsByDay(ownPullupsRows, 'pullups'),
      ...aggregateEligibleSubmissionsByWeek(ownPullupsRows, 'pullups'),
      ...aggregateEligibleSubmissionsByDay(ownKmRows, 'km'),
      ...aggregateEligibleSubmissionsByWeek(ownKmRows, 'km'),
    ]

    const allEntries = [...claimedEntries, ...appTrackedEntries]
    const bucket = {}

    allEntries.forEach((entry) => {
      if (!bucket[entry.recordType]) {
        bucket[entry.recordType] = []
      }

      bucket[entry.recordType].push(entry)
    })

    Object.keys(bucket).forEach((recordType) => {
      bucket[recordType] = bucket[recordType].sort(compareRecordEntries)
    })

    return bucket
  }, [kmQuery.data, pressupsQuery.data, pullupsQuery.data, profileYearSetup.recordEntries, userId])

  return {
    year,
    recordsByType,
    isLoading: profileYearSetup.isLoading || pressupsQuery.isLoading || pullupsQuery.isLoading || kmQuery.isLoading,
    error: profileYearSetup.error || pressupsQuery.error || pullupsQuery.error || kmQuery.error || null,
    hasAppTrackedSupport(recordType) {
      return APP_TRACKED_RECORD_TYPES.has(recordType)
    },
  }
}
