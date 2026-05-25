import { useQuery } from '@tanstack/react-query'
import { fetchIsAdmin } from '../api/adminUsers'
import { useAuth } from '../features/auth/AuthProvider'
import { useCurrentProfile } from './useCurrentProfile'

export function useIsAdmin() {
  const { session, status } = useAuth()
  const profileQuery = useCurrentProfile()
  const sessionUserId = session?.user?.id ?? ''
  const profileUserId = profileQuery.data?.id
    || (sessionUserId ? (sessionUserId.startsWith('user-') ? sessionUserId : `user-${sessionUserId}`) : '')
  const isReadyForCheck = status === 'authenticated' && Boolean(sessionUserId) && !profileQuery.isLoading

  const query = useQuery({
    queryKey: ['admin-users', profileUserId],
    queryFn: () => fetchIsAdmin(profileUserId),
    enabled: isReadyForCheck && Boolean(profileUserId),
    staleTime: 60_000,
  })

  return {
    ...query,
    isLoading: profileQuery.isLoading || query.isLoading,
    isError: profileQuery.isError || query.isError,
    isAdmin: query.data === true,
  }
}
