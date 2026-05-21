import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchProfileMonthlyTotals,
  fetchProfileRecordEntries,
  fetchProfileYear,
  fetchPublicProfileRecordEntries,
  getProfileMonthlyTotalsQueryKey,
  getProfileRecordEntriesQueryKey,
  getProfileYearQueryKey,
  getPublicProfileRecordEntriesQueryKey,
  upsertProfileMonthlyTotals,
  upsertProfileRecordEntries,
  upsertProfileYear,
} from '../api/profileYearSetup'
import { useAuth } from '../features/auth/AuthProvider'

export function useProfileYearSetup(year) {
  const { session, status } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id ?? ''
  const isEnabled = status === 'authenticated' && Boolean(userId) && Number.isInteger(year)
  const profileYearQueryKey = getProfileYearQueryKey(userId, year)
  const profileRecordEntriesQueryKey = getProfileRecordEntriesQueryKey(userId, year)
  const profileMonthlyTotalsQueryKey = getProfileMonthlyTotalsQueryKey(userId, year)
  const publicProfileRecordEntriesQueryKey = getPublicProfileRecordEntriesQueryKey(year)

  const profileYearQuery = useQuery({
    queryKey: profileYearQueryKey,
    queryFn: () => fetchProfileYear(userId, year),
    enabled: isEnabled,
    staleTime: 60_000,
  })

  const recordEntriesQuery = useQuery({
    queryKey: profileRecordEntriesQueryKey,
    queryFn: () => fetchProfileRecordEntries(userId, year),
    enabled: isEnabled,
    staleTime: 60_000,
  })

  const monthlyTotalsQuery = useQuery({
    queryKey: profileMonthlyTotalsQueryKey,
    queryFn: () => fetchProfileMonthlyTotals(userId, year),
    enabled: isEnabled,
    staleTime: 60_000,
  })

  const saveProfileYear = useMutation({
    mutationFn: (payload) => upsertProfileYear(userId, year, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(profileYearQueryKey, data)
      queryClient.invalidateQueries({ queryKey: profileYearQueryKey })
    },
  })

  const saveRecordEntries = useMutation({
    mutationFn: (records) => upsertProfileRecordEntries(userId, year, records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileRecordEntriesQueryKey })
      queryClient.invalidateQueries({ queryKey: publicProfileRecordEntriesQueryKey })
    },
  })

  const saveMonthlyTotals = useMutation({
    mutationFn: (totals) => upsertProfileMonthlyTotals(userId, year, totals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileMonthlyTotalsQueryKey })
    },
  })

  return {
    year,
    userId,
    profileYearQuery,
    recordEntriesQuery,
    monthlyTotalsQuery,
    profileYear: profileYearQuery.data ?? null,
    recordEntries: recordEntriesQuery.data ?? [],
    monthlyTotals: monthlyTotalsQuery.data ?? [],
    isLoading: profileYearQuery.isLoading || recordEntriesQuery.isLoading || monthlyTotalsQuery.isLoading,
    error: profileYearQuery.error || recordEntriesQuery.error || monthlyTotalsQuery.error || null,
    saveProfileYear,
    saveRecordEntries,
    saveMonthlyTotals,
  }
}

export function usePublicProfileRecordEntries(year) {
  return useQuery({
    queryKey: getPublicProfileRecordEntriesQueryKey(year),
    queryFn: () => fetchPublicProfileRecordEntries(year),
    enabled: Number.isInteger(year),
    staleTime: 60_000,
  })
}
