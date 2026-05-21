import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchVaultRecords } from '../api/submissions'
import { fetchPublicProfileRecordEntries, getPublicProfileRecordEntriesQueryKey } from '../api/profileYearSetup'
import { getLondonDateParts, getSubmissionPeriodKeys } from '../utils/dates'

export function getVaultRecordsQueryKey(circleId, year) {
  return ['vault', circleId, year]
}

const CLAIMED_RECORD_TYPES = [
  'pressups_set',
  'pullups_day',
  'pullups_week',
  'pullups_set',
  'fastest_5k',
  'fastest_10k',
  'half_marathon',
  'marathon',
  'longest_run',
]

const LOWER_IS_BETTER_RECORD_TYPES = new Set(['fastest_5k', 'fastest_10k', 'half_marathon', 'marathon'])
const SOURCE_PRIORITY = {
  verified: 3,
  app_tracked: 2,
  self_reported: 1,
}

function findTopGroup(rows, periodKey) {
  const groups = {}

  rows.forEach((row) => {
    const period = getSubmissionPeriodKeys(row.activityDate)[periodKey]
    if (!period) {
      return
    }

    const key = `${row.userId}:${period}`
    const value = Number(row.value) || 0

    if (!groups[key]) {
      groups[key] = {
        userId: row.userId,
        actorName: row.actorName || 'Unknown',
        period,
        value: 0,
        year: row.year ?? null,
      }
    }

    groups[key].value += value
  })

  return Object.values(groups).sort((a, b) => b.value - a.value)[0] || null
}

function normalizeSubmissionRecord(record, sourceLabel = 'app_tracked') {
  if (!record) {
    return null
  }

  return {
    ...record,
    sourceLabel,
    year: record.year ?? null,
    claimedAt: record.claimedAt ?? null,
  }
}

function compareClaimedRecords(a, b) {
  const isTimedRecord = LOWER_IS_BETTER_RECORD_TYPES.has(a.recordType)
  const aValue = isTimedRecord ? Number(a.valueSeconds ?? 0) : Number(a.comparableValue ?? 0)
  const bValue = isTimedRecord ? Number(b.valueSeconds ?? 0) : Number(b.comparableValue ?? 0)

  if (aValue !== bValue) {
    return isTimedRecord ? aValue - bValue : bValue - aValue
  }

  const aPriority = SOURCE_PRIORITY[a.sourceLabel] ?? 0
  const bPriority = SOURCE_PRIORITY[b.sourceLabel] ?? 0

  if (aPriority !== bPriority) {
    return bPriority - aPriority
  }

  return new Date(b.claimedAt ?? 0).getTime() - new Date(a.claimedAt ?? 0).getTime()
}

function findBestClaimedRecord(rows, recordType) {
  return rows
    .filter((row) => row.recordType === recordType)
    .sort(compareClaimedRecords)[0] || null
}

export function useVaultRecords({ circleId }) {
  const currentYear = getLondonDateParts(new Date()).year

  const query = useQuery({
    queryKey: getVaultRecordsQueryKey(circleId, currentYear),
    queryFn: async () => {
      const [appTrackedRecords, claimedRecords] = await Promise.all([
        fetchVaultRecords({ circleId, year: currentYear }),
        fetchPublicProfileRecordEntries(currentYear),
      ])

      return {
        appTrackedRecords,
        claimedRecords,
      }
    },
    enabled: Boolean(circleId),
    staleTime: 30_000,
  })

  const records = useMemo(() => {
    const pressups = query.data?.appTrackedRecords?.pressups ?? []
    const km = query.data?.appTrackedRecords?.km ?? []
    const claimedRows = query.data?.claimedRecords ?? []

    return {
      pressupsDay: normalizeSubmissionRecord(findTopGroup(pressups, 'todayKey')),
      pressupsWeek: normalizeSubmissionRecord(findTopGroup(pressups, 'weekKey')),
      kmDay: normalizeSubmissionRecord(findTopGroup(km, 'todayKey')),
      kmWeek: normalizeSubmissionRecord(findTopGroup(km, 'weekKey')),
      claimed: Object.fromEntries(
        CLAIMED_RECORD_TYPES.map((recordType) => [recordType, findBestClaimedRecord(claimedRows, recordType)]),
      ),
    }
  }, [query.data])

  return {
    ...query,
    records,
    currentYear,
    publicRecordsQueryKey: getPublicProfileRecordEntriesQueryKey(currentYear),
  }
}
