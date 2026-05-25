import { useMutation, useQueryClient } from '@tanstack/react-query'
import { finalizePeriodAwardsAllAdmin, isAdminOnlyError } from '../api/adminAwards'
import { getVaultAwardsQueryKey } from '../api/vaultAwards'

export function useAdminAwardFinalization(circleId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: finalizePeriodAwardsAllAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getVaultAwardsQueryKey(circleId) })
    },
  })
}

export function getAdminAwardFinalizationErrorCopy(error) {
  if (error?.code === 'RPC_NOT_READY') {
    return 'Admin RPC not ready.'
  }

  if (isAdminOnlyError(error)) {
    return 'Admin only.'
  }

  return "Couldn't finalise awards."
}
