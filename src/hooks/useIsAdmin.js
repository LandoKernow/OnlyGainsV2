import { useQuery } from '@tanstack/react-query'
import { fetchIsAdmin } from '../api/adminUsers'
import { useAuth } from '../features/auth/AuthProvider'

export function useIsAdmin() {
  const { session, status } = useAuth()
  const userId = session?.user?.id ?? ''

  const query = useQuery({
    queryKey: ['admin-users', userId],
    queryFn: () => fetchIsAdmin(userId),
    enabled: status === 'authenticated' && Boolean(userId),
    staleTime: 60_000,
  })

  return {
    ...query,
    isAdmin: query.data === true,
  }
}
