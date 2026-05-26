import { useQuery } from '@tanstack/react-query'
import { fetchIsAdmin } from '../api/adminUsers'
import { useAuth } from '../features/auth/AuthProvider'

export function useIsAdmin() {
  const { session, status } = useAuth()
  const sessionUserId = session?.user?.id ?? ''

  const query = useQuery({
    queryKey: ['is-current-user-admin', sessionUserId],
    queryFn: fetchIsAdmin,
    enabled: status === 'authenticated' && Boolean(sessionUserId),
    staleTime: 60_000,
  })

  if (import.meta.env.DEV) {
    console.debug('[Only Gains Admin]', {
      sessionUserId,
      isAdmin: query.data === true,
      error: query.error?.message || null,
    })
  }

  return {
    ...query,
    isLoading: query.isLoading,
    isError: query.isError,
    isAdmin: query.data === true,
  }
}
