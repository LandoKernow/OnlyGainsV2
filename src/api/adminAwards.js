import { supabase } from '../lib/supabase'

export function isAdminOnlyError(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    error?.code === '42501' ||
    message.includes('admin only') ||
    message.includes('permission denied')
  )
}

// Manual override: run the Crown sweep now (same logic the cron runs), via the
// admin-gated Worker endpoint. Awards crowns + shareable vault_awards rows,
// deduped server-side so it can never double-award. Replaces the retired
// legacy finalize_period_awards_all_admin path.
export async function runCrownSweepAdmin({ period = 'weekly' } = {}) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  if (!accessToken) {
    const authError = new Error('Not signed in.')
    authError.code = '42501'
    throw authError
  }

  const response = await fetch('/api/admin/run-crowns', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ period }),
  })

  if (response.status === 401 || response.status === 403) {
    const adminError = new Error('Admin only.')
    adminError.code = '42501'
    throw adminError
  }

  if (!response.ok) {
    throw new Error(`Crown sweep failed (${response.status}).`)
  }

  return response.json()
}
