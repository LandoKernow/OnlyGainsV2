import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchVaultAppTrackedRecords } from '../api/submissions'
import { fetchPublicProfileRecordEntries, getPublicProfileRecordEntriesQueryKey } from '../api/profileYearSetup'
import { fetchVaultRecordExclusions, getVaultRecordExclusionsQueryKey } from '../api/vaultRecordExclusions'
import { getLondonDateParts } from '../utils/dates'

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

function normalizeSubmissionRecord(record, sourceLabel = 'app_tracked') {
  if (!record) {
    return null
  }

  return {
    ...record,
    value: record.valueNumeric ?? 0,
    sourceLabel,
    year: record.year ?? null,
    claimedAt: record.claimedAt ?? null,
    sourceType: record.sourceType ?? 'submission',
    sourceId: record.sourceId ?? record.id ?? null,
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
    .sort(compareClaimedRecords)
    .map((row) => ({
      ...row,
      sourceType: 'profile_record_entry',
      sourceId: row.id,
    }))[0] || null
}

function createExclusionSet(rows) {
  return new Set(
    rows.map((row) => `${row.sourceType}:${row.sourceId}`),
  )
}

function isExcluded(exclusionSet, sourceType, sourceId) {
  if (!sourceType || !sourceId) {
    return false
  }

  return exclusionSet.has(`${sourceType}:${sourceId}`)
}

export function useVaultRecords({ circleId }) {
  const currentYear = getLondonDateParts(new Date()).year
  const exclusionsQueryKey = getVaultRecordExclusionsQueryKey()

  const query = useQuery({
    queryKey: getVaultRecordsQueryKey(circleId, currentYear),
    queryFn: async () => {
      const [appTrackedResult, claimedRecords, exclusions] = await Promise.all([
        fetchVaultAppTrackedRecords({ circleId, year: currentYear }),
        fetchPublicProfileRecordEntries(currentYear),
        fetchVaultRecordExclusions(),
      ])

      return {
        appTrackedRecords: appTrackedResult.rows,
        appTrackedUnavailable: appTrackedResult.unavailable,
        claimedRecords,
        exclusions,
      }
    },
    enabled: Boolean(circleId),
    staleTime: 30_000,
  })

  const records = useMemo(() => {
    const exclusionSet = createExclusionSet(query.data?.exclusions ?? [])
    const appTrackedRows = (query.data?.appTrackedRecords ?? []).filter(
      (row) => !isExcluded(exclusionSet, 'app_tracked', row.recordKey),
    )
    const claimedRows = (query.data?.claimedRecords ?? []).filter(
      (row) => !isExcluded(exclusionSet, 'profile_record_entry', row.id),
    )

    const findAppTrackedRecord = (recordKey) =>
      appTrackedRows.find((row) => row.recordKey === recordKey) ?? null

    return {
      pressupsDay: normalizeSubmissionRecord(findAppTrackedRecord('most_pressups_day')),
      pressupsWeek: normalizeSubmissionRecord(findAppTrackedRecord('most_pressups_week')),
      kmDay: normalizeSubmissionRecord(findAppTrackedRecord('most_km_day')),
      kmWeek: normalizeSubmissionRecord(findAppTrackedRecord('most_km_week')),
      claimed: Object.fromEntries(
        CLAIMED_RECORD_TYPES.map((recordType) => [recordType, findBestClaimedRecord(claimedRows, recordType)]),
      ),
    }
  }, [query.data])

  return {
    ...query,
    records,
    appTrackedUnavailable: query.data?.appTrackedUnavailable === true,
    currentYear,
    publicRecordsQueryKey: getPublicProfileRecordEntriesQueryKey(currentYear),
    exclusionsQueryKey,
  }
}
