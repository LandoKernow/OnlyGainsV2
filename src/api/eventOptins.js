import { supabase } from '../lib/supabase'

// Records the current warrior's opt-in for an event ("ANSWER THE CALL").
// Idempotent (PK user_id+event_key, ignore-duplicates). Fully dormant-safe:
// if the table isn't live yet the opt-in still succeeds locally.
export async function recordEventOptIn(userId, eventKey) {
  if (!supabase || !userId || !eventKey) {
    return false
  }

  try {
    const { error } = await supabase
      .from('event_optins')
      .upsert({ user_id: userId, event_key: eventKey }, { onConflict: 'user_id,event_key', ignoreDuplicates: true })

    return !error
  } catch {
    return false
  }
}
