import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLeaderboardSubmissions } from '../api/submissions'
import { useAuth } from '../features/auth/AuthProvider'
import { useBoardMeta } from './useBoardMeta'
import { useProfileYearSetup } from './useProfileYearSetup'
import { getLondonDateParts, getSubmissionPeriodKeys } from '../utils/dates'

const APP_TRACKED_RECORD_TYPES = new Set(['pressups_day', 'pressups_week', 'km_day', 'km_week'])
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

function groupSubmissionHistory(rows, recordType, periodKey) {
  const grouped = {}

  rows.forEach((row) => {
    const period = getSubmissionPeriodKeys(row.activityDate)[periodKey]

    if (!period) {
      return
    }

    const existing = grouped[period] ?? createHistoryEntry({
      recordType,
      unit: row.activityType === 'km' ? 'km' : 'reps',
      valueNumeric: 0,
      sourceLabel: 'app_tracked',
      year: row.year ?? null,
      sourceType: 'submission',
      sourceId: row.id,
      note: period,
    })

    existing.valueNumeric += Number(row.value) || 0

    if ((Number(row.value) || 0) >= Number(existing.valueNumeric || 0)) {
      existing.sourceId = row.id
    }

    grouped[period] = existing
  })

  return Object.values(grouped).sort(compareRecordEntries)
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
    const ownKmRows = (kmQuery.data ?? []).filter((row) => row.userId === userId)

    const appTrackedEntries = [
      ...groupSubmissionHistory(ownPressupsRows, 'pressups_day', 'todayKey'),
      ...groupSubmissionHistory(ownPressupsRows, 'pressups_week', 'weekKey'),
      ...groupSubmissionHistory(ownKmRows, 'km_day', 'todayKey'),
      ...groupSubmissionHistory(ownKmRows, 'km_week', 'weekKey'),
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
  }, [kmQuery.data, pressupsQuery.data, profileYearSetup.recordEntries, userId])

  return {
    year,
    recordsByType,
    isLoading: profileYearSetup.isLoading || pressupsQuery.isLoading || kmQuery.isLoading,
    error: profileYearSetup.error || pressupsQuery.error || kmQuery.error || null,
    hasAppTrackedSupport(recordType) {
      return APP_TRACKED_RECORD_TYPES.has(recordType)
    },
  }
}
