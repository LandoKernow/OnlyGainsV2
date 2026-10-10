import { supabase } from '../lib/supabase'
import { getLondonDateParts, getSubmissionPeriodKeys } from '../utils/dates'
import { getActivityUnit, isActiveActivityType } from '../utils/activityTypes'
import { isBoardLiveDiagnosticsUser } from '../lib/diagnostics'

function logSubmissionDebug(step, details) {
  if (!import.meta.env.DEV) {
    return
  }

  console.debug('[Only Gains Logging]', step, details)
}

function logBoardLiveDebug(step, details, userId) {
  if (!isBoardLiveDiagnosticsUser(userId)) {
    return
  }

  console.debug('[Only Gains Board Live]', step, details)
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

// Each id is a 36-char UUID in the request URL; batching keeps big boards
// well under URL length limits instead of failing the whole name lookup.
const PROFILE_LOOKUP_BATCH_SIZE = 100

async function fetchProfilesByUserIds(userIds) {
  if (userIds.length === 0) {
    return {}
  }

  const batches = []

  for (let index = 0; index < userIds.length; index += PROFILE_LOOKUP_BATCH_SIZE) {
    batches.push(userIds.slice(index, index + PROFILE_LOOKUP_BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map((batch) => supabase.from('profiles').select('id, name').in('id', batch)),
  )
  const profilesByUserId = {}

  for (const { data: profiles, error: profilesError } of results) {
    if (profilesError) {
      continue
    }

    for (const profile of profiles ?? []) {
      profilesByUserId[profile.id] = profile
    }
  }

  return profilesByUserId
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

  return (data ?? [])
    .filter((row) => isActiveActivityType(row.activity_type))
    .map((row) => mapSubmission(row, profilesByUserId))
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

// The canonical RPC whitelists activity types server-side. Until the DB
// migration adds a new type (e.g. pullups), it raises 22023 "Unsupported
// activity type" — reads then fall back to the legacy submissions query,
// the same path the app used before the RPCs existed.
export function isUnsupportedActivityTypeRpcError(error) {
  const message = String(error?.message || '').toLowerCase()

  return error?.code === '22023' || message.includes('unsupported activity type')
}

export async function fetchBoardActivityFeed({ boardId, limit, diagnosticsUserId = '', selectedBoardName = '' }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const normalizedBoardId = String(boardId || '').trim()

  if (!normalizedBoardId) {
    logBoardLiveDebug('fetchBoardActivityFeed skipped: missing board id', {
      selectedBoardName: selectedBoardName || null,
      requestedBoardId: boardId ?? null,
      normalizedBoardId: normalizedBoardId || null,
      limit,
    }, diagnosticsUserId)
    return []
  }

  logBoardLiveDebug('fetchBoardActivityFeed request', {
    selectedBoardName: selectedBoardName || null,
    requestedBoardId: boardId ?? null,
    normalizedBoardId,
    limit,
  }, diagnosticsUserId)

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

  const mappedRows = (data ?? [])
    .filter((row) => isActiveActivityType(row.activity_type))
    .map(mapBoardActivityFeedRow)
    .sort((left, right) => {
      const leftCreatedAt = Date.parse(left.createdAt || left.activityDate || 0)
      const rightCreatedAt = Date.parse(right.createdAt || right.activityDate || 0)

      if (Number.isNaN(leftCreatedAt) || Number.isNaN(rightCreatedAt)) {
        return 0
      }

      return rightCreatedAt - leftCreatedAt
    })

  logBoardLiveDebug('fetchBoardActivityFeed response', {
    selectedBoardName: selectedBoardName || null,
    boardId: normalizedBoardId,
    rowCount: mappedRows.length,
    rowIds: mappedRows.map((row) => row.id),
    legacySubmissionIds: mappedRows.map((row) => row.legacySubmissionId || null),
  }, diagnosticsUserId)

  return mappedRows
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

export async function debugSubmissionPropagation({
  submissionId,
  userId,
  activityType,
  value,
  activityDate,
  circleId,
  boardIds = [],
  feedLimit = 20,
}) {
  if (!import.meta.env.DEV || !supabase || !submissionId) {
    return null
  }

  const uniqueBoardIds = [...new Set((boardIds ?? []).map((boardId) => String(boardId || '').trim()).filter(Boolean))]
  const currentYear = getLondonDateParts(new Date(activityDate || Date.now())).year

  const { data: mirroredRows, error: mirroredError } = await supabase
    .from('activity_events')
    .select('id,user_id,activity_type,value,unit,source,activity_date,created_at,legacy_submission_id,deleted_at,deleted_by')
    .eq('legacy_submission_id', submissionId)

  const boardDiagnostics = await Promise.all(
    uniqueBoardIds.map(async (boardId) => {
      const [feedResult, leaderboardResult] = await Promise.all([
        supabase.rpc('get_board_activity_feed', {
          p_board_id: boardId,
          p_limit: feedLimit,
        }),
        supabase.rpc('get_board_leaderboard', {
          p_board_id: boardId,
          p_period: 'weekly',
          p_year: currentYear,
          p_activity_type: activityType,
        }),
      ])

      return {
        boardId,
        feedError: feedResult.error
          ? {
              code: feedResult.error.code ?? null,
              message: feedResult.error.message ?? null,
              details: feedResult.error.details ?? null,
              hint: feedResult.error.hint ?? null,
            }
          : null,
        feedCount: Array.isArray(feedResult.data) ? feedResult.data.length : 0,
        feedContainsSubmission: Array.isArray(feedResult.data)
          ? feedResult.data.some(
              (row) =>
                String(row?.legacy_submission_id || '').trim() === String(submissionId) ||
                String(row?.user_id || '').trim() === String(userId || '').trim() &&
                String(row?.activity_type || '').trim() === String(activityType || '').trim() &&
                Number(row?.value) === Number(value) &&
                String(row?.activity_date || '') === String(activityDate || ''),
            )
          : false,
        leaderboardError: leaderboardResult.error
          ? {
              code: leaderboardResult.error.code ?? null,
              message: leaderboardResult.error.message ?? null,
              details: leaderboardResult.error.details ?? null,
              hint: leaderboardResult.error.hint ?? null,
            }
          : null,
        leaderboardUserRow: Array.isArray(leaderboardResult.data)
          ? leaderboardResult.data.find((row) => String(row?.user_id || '').trim() === String(userId || '').trim()) ?? null
          : null,
      }
    }),
  )

  return {
    submission: {
      id: submissionId,
      userId,
      circleId,
      activityType,
      value,
      activityDate,
    },
    mirroredError: mirroredError
      ? {
          code: mirroredError.code ?? null,
          message: mirroredError.message ?? null,
          details: mirroredError.details ?? null,
          hint: mirroredError.hint ?? null,
        }
      : null,
    mirroredRows: mirroredRows ?? [],
    eligibleBoardIds: boardDiagnostics.filter((board) => board.feedContainsSubmission).map((board) => board.boardId),
    boardDiagnostics,
  }
}

// PostgREST silently caps every response (Supabase default: 1000 rows). A
// busy board passes that well inside a year, and the capped read used to drop
// rows without a word: yearly totals, XP levels, streaks and best-day records
// all undercounted. Same fix the Worker got in PR #8 — read the exact count,
// then fetch every remaining page in parallel.
const SUBMISSION_PAGE_SIZE = 1000

// buildQuery(withCount) must return a fully filtered submissions select,
// ordered oldest-first with an id tiebreak, so a log landing mid-read appends
// to the end instead of shifting rows between pages. Rows must carry `id`.
export async function fetchAllSubmissionPages(buildQuery) {
  const firstPage = await buildQuery(true).range(0, SUBMISSION_PAGE_SIZE - 1)

  if (firstPage.error) {
    throw firstPage.error
  }

  const rows = [...(firstPage.data ?? [])]
  const total = Number.isFinite(firstPage.count) ? firstPage.count : rows.length
  // The server cap may be lower than the page we asked for — step by what it
  // actually returned.
  const step = rows.length

  if (step > 0 && total > rows.length) {
    const offsets = []

    for (let offset = rows.length; offset < total; offset += step) {
      offsets.push(offset)
    }

    const pages = await Promise.all(offsets.map((offset) => buildQuery(false).range(offset, offset + step - 1)))

    for (const page of pages) {
      if (page.error) {
        throw page.error
      }

      rows.push(...(page.data ?? []))
    }
  }

  const seenIds = new Set()

  return rows.filter((row) => {
    if (seenIds.has(row.id)) {
      return false
    }

    seenIds.add(row.id)
    return true
  })
}

// Only what the derivations read. circle_id / activity_type are the query
// filters and get filled back in below, so the row shape is unchanged.
const LEADERBOARD_SUBMISSION_COLUMNS = 'id, user_id, value, source, activity_date, created_at'

export async function fetchLeaderboardSubmissions({ circleId, year, activityType = 'pressups' }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const rows = await fetchAllSubmissionPages((withCount) =>
    supabase
      .from('submissions')
      .select(LEADERBOARD_SUBMISSION_COLUMNS, withCount ? { count: 'exact' } : undefined)
      .eq('circle_id', circleId)
      .eq('activity_type', activityType)
      .eq('year', year)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
  )
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))]
  const profilesByUserId = await fetchProfilesByUserIds(userIds)
  const unit = getActivityUnit(activityType)

  // Newest first — the order every consumer has always received.
  return rows
    .reverse()
    .map((row) => mapSubmission({ ...row, circle_id: circleId, activity_type: activityType, unit }, profilesByUserId))
}

// The user's own training days this year across EVERY board and discipline —
// the same scope the Worker's STREAK_AT_RISK sweep reads. Returns London day
// keys (YYYY-MM-DD), oldest first, de-duplicated.
export async function fetchOwnTrainingDayKeys({ userId, year }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const rows = await fetchAllSubmissionPages((withCount) =>
    supabase
      .from('submissions')
      .select('id, activity_date', withCount ? { count: 'exact' } : undefined)
      .eq('user_id', userId)
      .eq('year', year)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
  )

  const dayKeys = new Set()

  for (const row of rows) {
    if (row.activity_date) {
      dayKeys.add(getSubmissionPeriodKeys(row.activity_date).todayKey)
    }
  }

  return [...dayKeys]
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
