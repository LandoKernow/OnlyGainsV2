import { supabase } from '../lib/supabase'

const BOARD_FEATURE_NOT_READY = 'BOARD_FEATURE_NOT_READY'
const GLOBAL_BOARD_ID = 'c769af17-6d63-41aa-8293-a4fd74d586f8'

function boardDebug(step, details) {
  if (!import.meta.env.DEV) {
    return
  }

  console.debug('[Only Gains Boards]', step, details)
}

function createBoardFeatureError(message = 'Board tools not ready.') {
  const error = new Error(message)
  error.code = BOARD_FEATURE_NOT_READY
  return error
}

function isMissingBoardFeature(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    error?.code === '42P01' ||
    error?.code === '42703' ||
    (message.includes('function') && message.includes('does not exist')) ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('could not find') && message.includes('board'))
  )
}

function normalizeBoard(row) {
  if (!row) {
    return null
  }

  const id = row.id || row.circle_id || row.board_id || ''

  if (!id) {
    return null
  }

  return {
    id,
    name: row.name || row.board_name || 'Untitled board',
    slug: row.slug || '',
    inviteCode: row.invite_code || row.inviteCode || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at || '',
    boardType: row.board_type || '',
    isPublic: row.is_public ?? true,
    role: row.role || row.membership_role || row.member_role || 'member',
    joinedAt: row.joined_at || '',
    memberCount: Number(row.member_count || 0) || 0,
    membershipStatus: row.membership_status || '',
    alreadyMember: Boolean(row.already_member),
  }
}

function normalizeBoardResult(data) {
  if (Array.isArray(data)) {
    return data.map(normalizeBoard).filter(Boolean)
  }

  const normalized = normalizeBoard(data)
  return normalized ? [normalized] : []
}

export function isBoardFeatureNotReadyError(error) {
  return error?.code === BOARD_FEATURE_NOT_READY
}

export async function fetchMyBoards() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase.rpc('get_my_boards')

  if (error) {
    if (isMissingBoardFeature(error)) {
      return {
        boards: [],
        featureReady: false,
      }
    }

    throw error
  }

  return {
    boards: normalizeBoardResult(data),
    featureReady: true,
  }
}

export async function createBoard({ name, boardType }) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const { data, error } = await supabase.rpc('create_board', {
    p_name: name,
    p_board_type: boardType,
  })

  if (error) {
    if (isMissingBoardFeature(error)) {
      throw createBoardFeatureError()
    }

    throw error
  }

  return normalizeBoard(Array.isArray(data) ? data[0] : data)
}

export async function fetchBoardInvitePreview(inviteCode) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const normalizedInviteCode = String(inviteCode || '').trim()

  if (!normalizedInviteCode) {
    return null
  }

  const { data, error } = await supabase.rpc('get_joinable_board_preview', {
    p_invite_code: normalizedInviteCode,
  })

  if (error) {
    if (isMissingBoardFeature(error)) {
      throw createBoardFeatureError('Board invite preview not ready.')
    }

    throw error
  }

  const rows = normalizeBoardResult(data)
  return rows[0] ?? null
}

export async function joinBoardByInvite(inviteCode) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const normalizedInviteCode = String(inviteCode || '').trim()

  if (!normalizedInviteCode) {
    throw new Error('Invite code required.')
  }

  const { data, error } = await supabase.rpc('join_board_by_invite', {
    p_invite_code: normalizedInviteCode,
  })

  if (error) {
    if (isMissingBoardFeature(error)) {
      throw createBoardFeatureError('Board join not ready.')
    }

    throw error
  }

  return normalizeBoard(Array.isArray(data) ? data[0] : data)
}

export async function fetchBoardInviteDetails(boardId) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const normalizedBoardId = String(boardId || '').trim()

  if (!normalizedBoardId) {
    return null
  }

  const { data, error } = await supabase.rpc('get_board_invite_details', {
    p_board_id: normalizedBoardId,
  })

  if (error) {
    if (isMissingBoardFeature(error)) {
      throw createBoardFeatureError('Board invite details not ready.')
    }

    throw error
  }

  const rows = normalizeBoardResult(data)
  return rows[0] ?? null
}

export async function leaveBoard(boardId) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }

  const normalizedBoardId = String(boardId || '').trim()

  if (!normalizedBoardId) {
    throw new Error('Board id required.')
  }

  boardDebug('leaveBoard rpc start', {
    boardId: normalizedBoardId,
    rpc: 'leave_board',
    argName: 'p_board_id',
    isGlobalBoard: normalizedBoardId === GLOBAL_BOARD_ID,
  })

  const { data, error } = await supabase.rpc('leave_board', {
    p_board_id: normalizedBoardId,
  })

  if (error) {
    boardDebug('leaveBoard rpc error', {
      boardId: normalizedBoardId,
      code: error.code ?? null,
      message: error.message ?? null,
    })

    if (isMissingBoardFeature(error)) {
      throw createBoardFeatureError('Leave board not ready.')
    }

    throw error
  }

  const normalizedResult = Array.isArray(data) ? data[0] ?? null : data ?? null

  boardDebug('leaveBoard rpc success', {
    boardId: normalizedBoardId,
    result: normalizedResult,
  })

  return normalizedResult
}
