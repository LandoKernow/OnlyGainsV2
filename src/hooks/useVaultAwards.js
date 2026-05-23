import { useQuery } from '@tanstack/react-query'
import { fetchVaultAwardById, fetchVaultAwards, getVaultAwardQueryKey, getVaultAwardsQueryKey } from '../api/vaultAwards'

export function useVaultAwards(circleId, options = {}) {
  const query = useQuery({
    queryKey: [...getVaultAwardsQueryKey(circleId), options.userId ?? 'all', options.limit ?? 6],
    queryFn: () => fetchVaultAwards(circleId, options),
    enabled: Boolean(circleId),
    staleTime: 30_000,
  })

  return {
    ...query,
    awards: query.data ?? [],
  }
}

export function useVaultAward(awardId) {
  const normalizedAwardId = String(awardId || '').trim()
  const query = useQuery({
    queryKey: getVaultAwardQueryKey(normalizedAwardId),
    queryFn: () => fetchVaultAwardById(normalizedAwardId),
    enabled: Boolean(normalizedAwardId),
    staleTime: 30_000,
  })

  return {
    ...query,
    awardId: normalizedAwardId,
    award: query.data ?? null,
    state: query.isLoading
      ? 'loading'
      : query.error
      ? 'error'
      : query.data
      ? 'success'
      : 'not-found',
  }
}
