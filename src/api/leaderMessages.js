import { supabase } from '../lib/supabase'

function mapLeaderMessage(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    circleId: row.circle_id,
    periodType: row.period_type,
    activityType: row.activity_type,
    weekStart: row.week_start,
    userId: row.user_id,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getWeeklyLeaderMessageQueryKey(circleId, weekStart) {
  return ['dashboard', 'weekly-leader-message', circleId, weekStart]
}

export function isLeaderMessagePermissionError(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    error?.code === '42501' ||
    message.includes('only the current weekly leader can take the mic') ||
    message.includes('not the current weekly leader') ||
    message.includes('no current weekly leader')
  )
}

export async function fetchWeeklyLeaderMessage({ circleId, weekStart, activityType = 'pressups', periodType = 'weekly' }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('leader_messages')
    .select('id,circle_id,period_type,activity_type,week_start,user_id,message,created_at,updated_at')
    .eq('circle_id', circleId)
    .eq('activity_type', activityType)
    .eq('period_type', periodType)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (error) {
    throw error
  }

  return mapLeaderMessage(data)
}

export async function setWeeklyLeaderMessage({
  circleId,
  activityType = 'pressups',
  message,
}) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .rpc('set_weekly_leader_message', {
      p_circle_id: circleId,
      p_activity_type: activityType,
      p_message: message,
    })
    .single()

  if (error) {
    throw error
  }

  return mapLeaderMessage(data)
}
