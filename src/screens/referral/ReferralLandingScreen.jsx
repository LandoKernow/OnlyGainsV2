import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { setPendingReferralCode } from '../../utils/referralCodes'

// /r/:refCode — captures the recruiter's code to localStorage (survives the
// auth redirect, same as board invites) then bounces to the app. Unauth users
// land on the signup gate; once authenticated, ConscriptionWatcher drops them
// on Global and ReferralWatcher claims the code. Path param, never query, so
// clearAuthUrlArtifacts can't wipe it.
export default function ReferralLandingScreen() {
  const { refCode } = useParams()

  useEffect(() => {
    if (refCode) {
      setPendingReferralCode(refCode)
    }
  }, [refCode])

  return <Navigate to="/dashboard" replace />
}
