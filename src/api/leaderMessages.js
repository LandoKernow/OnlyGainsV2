import { supabase } from '../lib/supabase'
import { createClientId } from '../utils/uuid'

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

export async function upsertWeeklyLeaderMessage({
  circleId,
  weekStart,
  activityType = 'pressups',
  periodType = 'weekly',
  userId,
  message,
  existingId,
}) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const payload = {
    id: existingId ?? createClientId(),
    circle_id: circleId,
    activity_type: activityType,
    period_type: periodType,
    week_start: weekStart,
    user_id: userId,
    message,
  }

  const { data, error } = await supabase
    .from('leader_messages')
    .upsert(payload, {
      onConflict: ['circle_id', 'period_type', 'activity_type', 'week_start'],
    })
    .select('id,circle_id,period_type,activity_type,week_start,user_id,message,created_at,updated_at')
    .single()

  if (error) {
    const sql = `create unique index if not exists leader_messages_unique_period on public.leader_messages (circle_id, period_type, activity_type, week_start);`
    error.message = `${error.message} If this fails because the unique constraint is missing, run: ${sql}`
    throw error
  }

  return mapLeaderMessage(data)
}
