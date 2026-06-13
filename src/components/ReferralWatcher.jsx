import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/AuthProvider'
import { claimReferral } from '../api/referrals'
import { clearPendingReferralCode, getPendingReferralCode } from '../utils/referralCodes'
import { REFERRALS_CONFIG } from '../config/referrals'

// Mirrors PendingBoardInviteWatcher: once the new account is authenticated,
// claim any captured referral code via the SECURITY DEFINER RPC (which
// enforces self-referral / set-once / veteran / malformed rules), then clear
// the pending code. Silent and idempotent — a no-op/invalid result just
// clears and moves on.
export function ReferralWatcher() {
  const { status, session } = useAuth()
  const queryClient = useQueryClient()
  const handledRef = useRef(false)

  useEffect(() => {
    if (!REFERRALS_CONFIG.enabled || status !== 'authenticated' || handledRef.current) {
      return
    }

    const code = getPendingReferralCode()

    if (!code) {
      return
    }

    handledRef.current = true

    claimReferral(code)
      .then((result) => {
        // 'claimed' | 'noop' | 'self' | 'veteran' | 'invalid' | null.
        // Any terminal answer means stop trying; only a thrown/networkless
        // null leaves it for a retry next session.
        if (result === null) {
          handledRef.current = false
          return
        }

        clearPendingReferralCode()

        if (result === 'claimed') {
          // Refresh the recruit's auto-rivalry target + the recruiter's count.
          queryClient.invalidateQueries({ queryKey: ['referrals'] })
        }
      })
      .catch(() => {
        handledRef.current = false
      })
  }, [queryClient, session?.user?.id, status])

  return null
}
