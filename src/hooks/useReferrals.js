import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'
import { fetchMyRecruiterId, fetchMyReferralCode, fetchRecruitCount } from '../api/referrals'
import { getRecruiterTier } from '../config/referrals'

// The current user's recruit count + active RECRUITER tier.
export function useRecruits() {
  const { status } = useAuth()

  const query = useQuery({
    queryKey: ['referrals', 'recruit-count'],
    queryFn: fetchRecruitCount,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  })

  const count = query.data ?? 0

  return {
    isLoading: query.isLoading,
    count,
    tier: getRecruiterTier(count),
  }
}

// The current user's own shareable referral code.
export function useMyReferralCode() {
  const { session, status } = useAuth()
  const userId = session?.user?.id

  const query = useQuery({
    queryKey: ['referrals', 'my-code', userId],
    queryFn: () => fetchMyReferralCode(userId),
    enabled: status === 'authenticated' && Boolean(userId),
    staleTime: 300_000,
  })

  return query.data ?? ''
}

// The current user's recruiter (for auto-rivalry): id + display name, or null.
export function useMyRecruiter() {
  const { status } = useAuth()

  const recruiterIdQuery = useQuery({
    queryKey: ['referrals', 'my-recruiter'],
    queryFn: fetchMyRecruiterId,
    enabled: status === 'authenticated',
    staleTime: 300_000,
  })

  const recruiterId = recruiterIdQuery.data ?? null

  const nameQuery = useQuery({
    queryKey: ['referrals', 'recruiter-name', recruiterId],
    queryFn: async () => {
      if (!supabase || !recruiterId) {
        return ''
      }
      const { data } = await supabase.from('profiles').select('name').eq('id', recruiterId).maybeSingle()
      return data?.name ?? ''
    },
    enabled: status === 'authenticated' && Boolean(recruiterId),
    staleTime: 300_000,
  })

  return {
    recruiterId,
    recruiterName: nameQuery.data ?? '',
    isLoading: recruiterIdQuery.isLoading,
  }
}
