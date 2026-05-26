import { supabase } from '../lib/supabase'

export function getAdminUserIdCandidates(userId) {
  const normalized = String(userId || '').trim()

  if (!normalized) {
    return []
  }

  if (normalized.startsWith('user-')) {
    return [normalized, normalized.slice(5)].filter(Boolean)
  }

  return [normalized, `user-${normalized}`]
}

export async function fetchIsAdmin(userId) {
  const userIds = getAdminUserIdCandidates(userId)

  if (!supabase || userIds.length === 0) {
    return false
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .in('user_id', userIds)
    .limit(1)

  if (error) {
    return false
  }

  return Array.isArray(data) && data.length > 0
}
