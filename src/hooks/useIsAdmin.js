import { useQuery } from '@tanstack/react-query'
import { fetchAdminStatus } from '../api/adminUsers'
import { useAuth } from '../features/auth/AuthProvider'

export function useIsAdmin() {
  const { session, status } = useAuth()
  const sessionUserId = session?.user?.id ?? ''
  const queryKey = ['is-current-user-admin', sessionUserId]

  const query = useQuery({
    queryKey,
    queryFn: fetchAdminStatus,
    enabled: status === 'authenticated' && Boolean(sessionUserId),
    staleTime: 60_000,
  })

  if (import.meta.env.DEV) {
    console.debug('[Only Gains Admin]', {
      sessionUserId,
      rpcValue: query.data?.rpcValue ?? null,
      isAdmin: query.data?.isAdmin === true,
      errorCode: query.data?.errorCode ?? null,
      errorMessage: query.data?.errorMessage ?? query.error?.message ?? null,
      queryKey,
    })
  }

  return {
    ...query,
    isLoading: query.isLoading,
    isError: query.isError,
    isAdmin: query.data?.isAdmin === true,
    rpcValue: query.data?.rpcValue ?? null,
    rpcErrorCode: query.data?.errorCode ?? null,
    rpcErrorMessage: query.data?.errorMessage ?? null,
    queryKey,
  }
}
