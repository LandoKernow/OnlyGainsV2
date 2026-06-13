import { supabase } from '../lib/supabase'

// Detects the referral RPC/table not being live yet, so the loop stays fully
// dormant (no errors surfaced) until the migration runs.
function isMissingReferralBackend(error) {
  const message = String(error?.message || '').toLowerCase()
  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    error?.code === '42P01' ||
    (message.includes('claim_referral') && message.includes('not')) ||
    message.includes('does not exist') ||
    message.includes('could not find')
  )
}

// Calls the SECURITY DEFINER RPC. Returns the status string, or null if the
// backend isn't ready / the call fails (loop stays silent).
export async function claimReferral(code) {
  if (!supabase || !code) {
    return null
  }

  const { data, error } = await supabase.rpc('claim_referral', { p_code: code })

  if (error) {
    return null
  }

  return data ?? null
}

export async function fetchMyReferralCode(userId) {
  if (!supabase || !userId) {
    return ''
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return ''
  }

  return data?.referral_code ?? ''
}

// Live recruit count for the current user (RLS: recruiter reads own recruits;
// deleted recruits cascade out of the table, so this is always live).
export async function fetchRecruitCount() {
  if (!supabase) {
    return 0
  }

  const { count, error } = await supabase
    .from('referrals')
    .select('recruit_id', { count: 'exact', head: true })

  if (error) {
    return 0
  }

  return count ?? 0
}

// The current user's own recruiter (for auto-rivalry), or null.
export async function fetchMyRecruiterId() {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('referrals')
    .select('recruiter_id')
    .maybeSingle()

  if (error || !data?.recruiter_id) {
    return null
  }

  return data.recruiter_id
}

export { isMissingReferralBackend }
