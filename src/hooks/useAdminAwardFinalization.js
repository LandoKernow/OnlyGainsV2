import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAdminOnlyError, runCrownSweepAdmin } from '../api/adminAwards'
import { getVaultAwardsQueryKey } from '../api/vaultAwards'

// Crowns are now the single source of period awards. This manual override runs
// the same sweep the cron runs; the legacy finalize_period_awards_all_admin
// path is retired.
export function useCrownSweepAdmin(circleId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: runCrownSweepAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getVaultAwardsQueryKey(circleId) })
    },
  })
}

export function getAdminAwardFinalizationErrorCopy(error) {
  if (isAdminOnlyError(error)) {
    return 'Admin only.'
  }

  return "Couldn't run the crown sweep."
}
