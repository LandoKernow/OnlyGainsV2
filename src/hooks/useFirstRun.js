import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'

const CONSCRIPTION_KEY_PREFIX = 'only_gains_conscripted_v1'
const FIRST_BLOOD_KEY_PREFIX = 'only_gains_first_blood_v1'

function key(prefix, userId) {
  return `${prefix}_${userId}`
}

function readFlag(storageKey) {
  try {
    return globalThis.localStorage?.getItem(storageKey) === 'true'
  } catch {
    return false
  }
}

function writeFlag(storageKey) {
  try {
    globalThis.localStorage?.setItem(storageKey, 'true')
  } catch {
    // Restrictive storage: guards degrade, never crash.
  }
}

// Durable FIRST BLOOD truth: either a FIRST_BLOOD event (already coronated) or
// a first_blood_exempt row (a veteran who existed at deploy — never eligible).
// Both are server-side and read under the user's own RLS, so the instant
// client takeover stays exactly in step with the Worker's award gate. No
// dependency on submission history anywhere. localStorage is only a fast
// same-device guard for users who just drew first blood.
async function fetchFirstBloodState() {
  if (!supabase) {
    return { coronated: false, exempt: false }
  }

  const [eventResult, exemptResult] = await Promise.all([
    supabase.from('notification_events').select('id').eq('type', 'FIRST_BLOOD').limit(1),
    supabase.from('first_blood_exempt').select('user_id').limit(1),
  ])

  return {
    coronated: Boolean((eventResult.data ?? [])[0]),
    exempt: Boolean((exemptResult.data ?? [])[0]),
  }
}

export function useFirstRun() {
  const { session, status } = useAuth()
  const userId = session?.user?.id ?? ''
  const isAuthenticated = status === 'authenticated' && Boolean(userId)

  const firstBloodQuery = useQuery({
    queryKey: ['onboarding', 'first-blood', userId],
    queryFn: fetchFirstBloodState,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  // Done = already coronated, OR a deploy-time veteran (exempt), OR this device
  // already fired it. Veterans never fire first blood — kept sacred to genuine
  // first sessions.
  const firstBloodDone =
    Boolean(firstBloodQuery.data?.coronated) ||
    Boolean(firstBloodQuery.data?.exempt) ||
    (Boolean(userId) && readFlag(key(FIRST_BLOOD_KEY_PREFIX, userId)))

  const introSeen = Boolean(userId) && readFlag(key(CONSCRIPTION_KEY_PREFIX, userId))
  const isExemptVeteran = Boolean(firstBloodQuery.data?.exempt)

  return {
    isAuthenticated,
    userId,
    // The conscription intro shows for genuine newcomers only: authenticated,
    // not yet seen, and NOT a deploy-time veteran. Held back until the
    // exemption check resolves so it never flashes before we know the cohort.
    showIntro: isAuthenticated && !introSeen && !firstBloodQuery.isLoading && !isExemptVeteran,
    // First blood still available to draw.
    firstBloodPending: isAuthenticated && !firstBloodDone && !firstBloodQuery.isLoading,
    firstBloodDone,
    isExemptVeteran,
    markIntroSeen() {
      if (userId) writeFlag(key(CONSCRIPTION_KEY_PREFIX, userId))
    },
    markFirstBloodDrawn() {
      if (userId) writeFlag(key(FIRST_BLOOD_KEY_PREFIX, userId))
    },
  }
}
