import { supabase } from '../lib/supabase'

// Fires the one-off launch broadcast to the event opt-in list. Admin-gated by
// the caller's own Supabase JWT (no floating secret) — same pattern as the
// crown override. The Worker enforces admin + idempotency; this just carries
// the token. Returns { eventKey, optins, sent, skipped }.
export async function fireEventLaunchBroadcast() {
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

  const response = await fetch('/api/event/launch-broadcast', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (response.status === 401 || response.status === 403) {
    const adminError = new Error('Admin only.')
    adminError.code = '42501'
    throw adminError
  }

  if (!response.ok) {
    throw new Error(`Launch broadcast failed (${response.status}).`)
  }

  return response.json()
}
