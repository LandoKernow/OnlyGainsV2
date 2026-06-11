import { supabase } from '../lib/supabase'
import { NOTIFICATIONS_CONFIG } from '../config/notifications'

// Reads/marks the user's own notification_events rows (RLS-scoped).
// Event CREATION lives in the Cloudflare Worker — never here.

export async function fetchNotificationEvents({ limit = 50 } = {}) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('notification_events')
    .select('id, type, priority, actor_user_id, actor_name, payload, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data ?? []
}

export async function fetchUnreadCount() {
  if (!supabase) {
    return 0
  }

  const { count, error } = await supabase
    .from('notification_events')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) {
    return 0
  }

  return count ?? 0
}

export async function markAllEventsRead() {
  if (!supabase) {
    return
  }

  const { error } = await supabase
    .from('notification_events')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)

  if (error) {
    throw error
  }
}

// --- Preferences -----------------------------------------------------------

export async function fetchNotificationPrefs(userId) {
  if (!supabase) {
    return { globalMute: false, categories: { ...NOTIFICATIONS_CONFIG.defaultCategories } }
  }

  const { data, error } = await supabase
    .from('notification_prefs')
    .select('global_mute, categories')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return {
    globalMute: data?.global_mute ?? false,
    categories: { ...NOTIFICATIONS_CONFIG.defaultCategories, ...(data?.categories ?? {}) },
  }
}

export async function saveNotificationPrefs(userId, { globalMute, categories }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { error } = await supabase.from('notification_prefs').upsert({
    user_id: userId,
    global_mute: globalMute,
    categories,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    throw error
  }
}

// --- Push subscriptions ------------------------------------------------------

export async function savePushSubscription(userId, subscription) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent.slice(0, 255),
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    throw error
  }
}

export async function removePushSubscription(endpoint) {
  if (!supabase || !endpoint) {
    return
  }

  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// --- Worker ping (fire-and-forget after a successful log) -------------------

export function pingEventEngine(submissionId) {
  try {
    void fetch('/api/events/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // The engine being down never touches the logging experience.
  }
}
