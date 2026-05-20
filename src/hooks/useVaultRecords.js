import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchVaultRecords } from '../api/submissions'
import { getLondonDateParts, getSubmissionPeriodKeys } from '../utils/dates'

export function getVaultRecordsQueryKey(circleId, year) {
  return ['vault', circleId, year]
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
      }
    }

    groups[key].value += value
  })

  return Object.values(groups).sort((a, b) => b.value - a.value)[0] || null
}

export function useVaultRecords({ circleId }) {
  const currentYear = getLondonDateParts(new Date()).year

  const query = useQuery({
    queryKey: getVaultRecordsQueryKey(circleId, currentYear),
    queryFn: () => fetchVaultRecords({ circleId, year: currentYear }),
    enabled: Boolean(circleId),
    staleTime: 30_000,
  })

  const records = useMemo(() => {
    const pressups = query.data?.pressups ?? []
    const km = query.data?.km ?? []

    return {
      pressupsDay: findTopGroup(pressups, 'todayKey'),
      pressupsWeek: findTopGroup(pressups, 'weekKey'),
      kmDay: findTopGroup(km, 'todayKey'),
      kmWeek: findTopGroup(km, 'weekKey'),
    }
  }, [query.data])

  return {
    ...query,
    records,
    currentYear,
  }
}
