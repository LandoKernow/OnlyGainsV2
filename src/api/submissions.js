import { supabase } from '../lib/supabase'

function logSubmissionDebug(step, details) {
  if (!import.meta.env.DEV) {
    return
  }

  console.debug('[Only Gains Logging]', step, details)
}

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

function mapBoardActivityFeedRow(row) {
  return {
    id: row.id,
    circleId: row.circle_id || '',
    userId: row.user_id,
    activityType: row.activity_type,
    value: Number(row.value),
    unit: row.unit,
    source: row.source,
    activityDate: row.activity_date,
    createdAt: row.created_at,
    note: row.note ?? '',
    actorName: row.user_name || '',
    legacySubmissionId: row.legacy_submission_id || '',
    pending: false,
  }
}

function mapBoardLeaderboardRow(row) {
  return {
    userId: row.user_id,
    actorName: row.user_name || 'Unnamed warrior',
    total: Number(row.total) || 0,
    todayTotal: Number(row.today_total) || 0,
    lastCreatedAt: row.last_created_at,
    rank: Number(row.rank) || 0,
    pending: false,
  }
}

async function fetchProfilesByUserIds(userIds) {
  if (userIds.length === 0) {
    return {}
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds)

  if (profilesError) {
    return {}
  }

  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]))
}

export async function createSubmission(payload) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  logSubmissionDebug('createSubmission payload', {
    keys: Object.keys(payload ?? {}),
    id: payload?.id ?? null,
    circle_id: payload?.circle_id ?? null,
    user_id: payload?.user_id ?? null,
    activity_type: payload?.activity_type ?? null,
    value: payload?.value ?? null,
    unit: payload?.unit ?? null,
    activity_date: payload?.activity_date ?? null,
    source: payload?.source ?? null,
    year: payload?.year ?? null,
    month: payload?.month ?? null,
  })

  const { data, error } = await supabase
    .from('submissions')
    .insert(payload)
    .select('id, circle_id, user_id, activity_type, value, unit, source, activity_date, created_at, note')
    .single()

  if (error) {
    logSubmissionDebug('createSubmission error', {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })
    throw error
  }

  logSubmissionDebug('createSubmission success', {
    id: data?.id ?? null,
    user_id: data?.user_id ?? null,
    circle_id: data?.circle_id ?? null,
    activity_type: data?.activity_type ?? null,
    value: data?.value ?? null,
  })

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
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))]
  const profilesByUserId = await fetchProfilesByUserIds(userIds)

  return (data ?? []).map((row) => mapSubmission(row, profilesByUserId))
}

function isMissingBoardFeedRpc(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    (message.includes('get_board_activity_feed') && message.includes('could not find')) ||
    (message.includes('function') && message.includes('does not exist'))
  )
}

export function isMissingBoardLeaderboardRpc(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    (message.includes('get_board_leaderboard') && message.includes('could not find')) ||
    (message.includes('function') && message.includes('does not exist'))
  )
}

export async function fetchBoardActivityFeed({ boardId, limit }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const normalizedBoardId = String(boardId || '').trim()

  if (!normalizedBoardId) {
    return []
  }

  const { data, error } = await supabase.rpc('get_board_activity_feed', {
    p_board_id: normalizedBoardId,
    p_limit: limit,
  })

  if (error) {
    if (isMissingBoardFeedRpc(error)) {
      if (import.meta.env.DEV) {
        console.warn('[Only Gains Board] get_board_activity_feed RPC not ready yet.')
      }

      return fetchRecentSubmissions({ circleId: normalizedBoardId, limit })
    }

    throw error
  }

  return (data ?? []).map(mapBoardActivityFeedRow)
}

export async function fetchBoardLeaderboard({ boardId, period, year, activityType = 'pressups' }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const normalizedBoardId = String(boardId || '').trim()

  if (!normalizedBoardId) {
    return []
  }

  const { data, error } = await supabase.rpc('get_board_leaderboard', {
    p_board_id: normalizedBoardId,
    p_period: period,
    p_year: year,
    p_activity_type: activityType,
  })

  if (error) {
    throw error
  }

  return (data ?? []).map(mapBoardLeaderboardRow)
}

export async function fetchLeaderboardSubmissions({ circleId, year, activityType = 'pressups' }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('id, circle_id, user_id, activity_type, value, unit, source, activity_date, created_at, note, year')
    .eq('circle_id', circleId)
    .eq('activity_type', activityType)
    .eq('year', year)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean))]
  const profilesByUserId = await fetchProfilesByUserIds(userIds)

  return (data ?? []).map((row) => mapSubmission(row, profilesByUserId))
}

export async function fetchPressupLeaderboardSubmissions({ circleId, year }) {
  return fetchLeaderboardSubmissions({ circleId, year, activityType: 'pressups' })
}

function isMissingVaultRecordsRpc(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    (message.includes('get_vault_app_tracked_records') && message.includes('could not find')) ||
    (message.includes('function') && message.includes('does not exist'))
  )
}

function mapVaultAppTrackedRecord(row) {
  return {
    recordKey: row.record_key,
    activityType: row.activity_type,
    periodType: row.period_type,
    userId: row.user_id,
    actorName: row.user_name || 'Unknown',
    value: Number(row.value) || 0,
    valueNumeric: Number(row.value) || 0,
    unit: row.unit || (row.activity_type === 'km' ? 'km' : 'reps'),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    sourceLabel: row.source_type || 'app_tracked',
    sourceType: row.source_type || 'app_tracked',
    year: row.period_start ? new Date(`${row.period_start}T12:00:00.000Z`).getUTCFullYear() : null,
  }
}

export async function fetchVaultAppTrackedRecords({ circleId, year }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase
    .rpc('get_vault_app_tracked_records', {
      p_circle_id: circleId,
      p_year: year,
    })

  if (error) {
    if (isMissingVaultRecordsRpc(error)) {
      if (import.meta.env.DEV) {
        console.warn('[Only Gains Vault] get_vault_app_tracked_records RPC not ready yet.')
      }

      return {
        rows: [],
        unavailable: true,
      }
    }

    throw error
  }

  return {
    rows: (data ?? []).map(mapVaultAppTrackedRecord),
    unavailable: false,
  }
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
