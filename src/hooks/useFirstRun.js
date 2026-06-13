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

// Durable, device-independent FIRST BLOOD truth: a FIRST_BLOOD event in
// notification_events (written once-ever by the Worker, readable by the user
// under their own RLS). localStorage is only a fast same-device guard.
async function fetchFirstBloodEvent() {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase
    .from('notification_events')
    .select('id')
    .eq('type', 'FIRST_BLOOD')
    .limit(1)

  if (error) {
    return null
  }

  return (data ?? [])[0] ?? null
}

export function useFirstRun() {
  const { session, status } = useAuth()
  const userId = session?.user?.id ?? ''
  const isAuthenticated = status === 'authenticated' && Boolean(userId)

  const firstBloodQuery = useQuery({
    queryKey: ['onboarding', 'first-blood', userId],
    queryFn: fetchFirstBloodEvent,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  // Done = durable server record exists, OR this device already fired it.
  const firstBloodDone =
    Boolean(firstBloodQuery.data) || (Boolean(userId) && readFlag(key(FIRST_BLOOD_KEY_PREFIX, userId)))

  const introSeen = Boolean(userId) && readFlag(key(CONSCRIPTION_KEY_PREFIX, userId))

  return {
    isAuthenticated,
    userId,
    // The conscription intro should show: authenticated, not yet seen.
    showIntro: isAuthenticated && !introSeen,
    // First blood still available to draw.
    firstBloodPending: isAuthenticated && !firstBloodDone && !firstBloodQuery.isLoading,
    firstBloodDone,
    markIntroSeen() {
      if (userId) writeFlag(key(CONSCRIPTION_KEY_PREFIX, userId))
    },
    markFirstBloodDrawn() {
      if (userId) writeFlag(key(FIRST_BLOOD_KEY_PREFIX, userId))
    },
  }
}
