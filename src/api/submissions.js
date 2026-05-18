import { supabase } from '../lib/supabase'

function mapSubmission(row, profilesByUserId = {}) {
  return {
    id: row.id,
    circleId: row.circle_id,
    userId: row.user_id,
    activityType: row.activity_type,
    value: Number(row.value),
    unit: row.unit,
    source: row.source,
    activityDate: row.activity_date,
    createdAt: row.created_at,
    note: row.note ?? '',
    actorName: profilesByUserId[row.user_id]?.name ?? '',
    pending: false,
  }
}

export async function createSubmission(payload) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('submissions')
    .insert(payload)
    .select('id, circle_id, user_id, activity_type, value, unit, source, activity_date, created_at, note')
    .single()

  if (error) {
    throw error
  }

  return mapSubmission(data)
}

export async function fetchRecentSubmissions({ circleId, limit }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('id, circle_id, user_id, activity_type, value, unit, source, activity_date, created_at, note')
    .eq('circle_id', circleId)
    .eq('activity_type', 'pressups')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))]

  let profilesByUserId = {}

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds)

    if (profilesError) {
      throw profilesError
    }

    profilesByUserId = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]))
  }

  return (data ?? []).map((row) => mapSubmission(row, profilesByUserId))
}

export async function fetchPressupLeaderboardSubmissions({ circleId, year }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('id, circle_id, user_id, activity_type, value, unit, source, activity_date, created_at, note, year')
    .eq('circle_id', circleId)
    .eq('activity_type', 'pressups')
    .eq('year', year)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))]
  let profilesByUserId = {}

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds)

    if (profilesError) {
      throw profilesError
    }

    profilesByUserId = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]))
  }

  return (data ?? []).map((row) => mapSubmission(row, profilesByUserId))
}

export async function deleteSubmissionById(id, userId) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return { id }
}
