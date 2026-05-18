import { useQuery } from '@tanstack/react-query'
import { ensureMyProfile } from '../api/profiles'
import { useAuth } from '../features/auth/AuthProvider'

export function useCurrentProfile() {
  const { session, status } = useAuth()

  return useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => ensureMyProfile(session.user),
    enabled: status === 'authenticated' && Boolean(session?.user?.id),
    staleTime: 60_000,
  })
}
