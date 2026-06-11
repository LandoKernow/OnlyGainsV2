import { getSubmissionPeriodKeys } from './dates'
import { isVaultEligibleSubmission } from './vaultEligibility'
import { getActivityUnit, normalizeActivityType } from './activityTypes'

function getPeriodValue(row) {
  return Number(row?.value) || 0
}

function createAggregate(row, recordType, period) {
  const activityType = normalizeActivityType(row?.activityType)

  return {
    userId: row?.userId || '',
    actorName: row?.actorName || 'Unknown',
    activityType,
    unit: getActivityUnit(activityType),
    recordType,
    period,
    valueNumeric: 0,
    comparableValue: 0,
    year: row?.year ?? null,
    sourceLabel: 'app_tracked',
    sourceType: 'submission',
    sourceId: row?.id ?? null,
    sourceIds: [],
    note: period,
    topSubmissionValue: getPeriodValue(row),
    latestActivityDate: row?.activityDate || '',
  }
}

function compareAggregateRecords(a, b) {
  const aValue = Number(a?.valueNumeric ?? 0)
  const bValue = Number(b?.valueNumeric ?? 0)

  if (aValue !== bValue) {
    return bValue - aValue
  }

  const aLatest = new Date(a?.latestActivityDate || 0).getTime()
  const bLatest = new Date(b?.latestActivityDate || 0).getTime()

  if (aLatest !== bLatest) {
    return bLatest - aLatest
  }

  return String(a?.actorName || '').localeCompare(String(b?.actorName || ''))
}

function aggregateEligibleSubmissionsByPeriod(submissions, activityType, periodKey, recordType) {
  const normalizedActivityType = normalizeActivityType(activityType)
  const groups = {}

  ;(submissions ?? []).forEach((row) => {
    if (!row || row.activityType !== normalizedActivityType || !isVaultEligibleSubmission(row)) {
      return
    }

    const period = getSubmissionPeriodKeys(row.activityDate)?.[periodKey]

    if (!period) {
      return
    }

    const key = `${row.userId}:${period}`
    const value = getPeriodValue(row)
    const existing = groups[key] ?? createAggregate(row, recordType, period)

    existing.valueNumeric += value
    existing.comparableValue = existing.valueNumeric
    existing.sourceIds.push(row.id)

    if (value >= Number(existing.topSubmissionValue ?? 0)) {
      existing.topSubmissionValue = value
      existing.sourceId = row.id
    }

    if (String(row.activityDate || '') >= String(existing.latestActivityDate || '')) {
      existing.latestActivityDate = row.activityDate || existing.latestActivityDate
    }

    groups[key] = existing
  })

  return Object.values(groups).sort(compareAggregateRecords)
}

export function getLondonDayKey(activityDate) {
  return getSubmissionPeriodKeys(activityDate)?.todayKey ?? ''
}

export function getLondonWeekKey(activityDate) {
  return getSubmissionPeriodKeys(activityDate)?.weekKey ?? ''
}

export function aggregateEligibleSubmissionsByDay(submissions, activityType) {
  const normalizedActivityType = normalizeActivityType(activityType)
  return aggregateEligibleSubmissionsByPeriod(
    submissions,
    normalizedActivityType,
    'todayKey',
    `${normalizedActivityType}_day`,
  )
}

export function aggregateEligibleSubmissionsByWeek(submissions, activityType) {
  const normalizedActivityType = normalizeActivityType(activityType)
  return aggregateEligibleSubmissionsByPeriod(
    submissions,
    normalizedActivityType,
    'weekKey',
    `${normalizedActivityType}_week`,
  )
}

export function getBestDayRecord(submissions, activityType) {
  return aggregateEligibleSubmissionsByDay(submissions, activityType)[0] ?? null
}

export function getBestWeekRecord(submissions, activityType) {
  return aggregateEligibleSubmissionsByWeek(submissions, activityType)[0] ?? null
}
