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
  const query = useQuery({
    queryKey: getVaultAwardQueryKey(awardId),
    queryFn: () => fetchVaultAwardById(awardId),
    enabled: Boolean(awardId),
    staleTime: 30_000,
  })

  return {
    ...query,
    award: query.data ?? null,
  }
}
