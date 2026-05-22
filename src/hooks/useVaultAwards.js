import { useQuery } from '@tanstack/react-query'
import { fetchVaultAwards, getVaultAwardsQueryKey } from '../api/vaultAwards'

export function useVaultAwards(circleId) {
  const query = useQuery({
    queryKey: getVaultAwardsQueryKey(circleId),
    queryFn: () => fetchVaultAwards(circleId),
    enabled: Boolean(circleId),
    staleTime: 30_000,
  })

  return {
    ...query,
    awards: query.data ?? [],
  }
}
