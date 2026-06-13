import { useEffect, useRef } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { useBoardMeta } from '../hooks/useBoardMeta'
import { useJoinBoard } from '../hooks/useBoards'
import { ONBOARDING_CONFIG } from '../config/onboarding'
import { GLOBAL_BOARD_ID, isGlobalBoardId } from '../utils/boards'

const CONSCRIPTED_KEY_PREFIX = 'only_gains_global_conscripted_v1'

function conscriptedKey(userId) {
  return `${CONSCRIPTED_KEY_PREFIX}_${userId}`
}

function hasConscripted(userId) {
  try {
    return globalThis.localStorage?.getItem(conscriptedKey(userId)) === 'true'
  } catch {
    return false
  }
}

function markConscripted(userId) {
  try {
    globalThis.localStorage?.setItem(conscriptedKey(userId), 'true')
  } catch {
    // Non-fatal: at worst we re-attempt the idempotent join next session.
  }
}

// Drops every authenticated warrior onto the Global Board via the existing
// 'GLOBAL' invite path — idempotent (already-member is a no-op), once per
// user per device. Never touches the logging write path. So a brand-new
// account is never staring at an empty board.
export function ConscriptionWatcher() {
  const { session, status } = useAuth()
  const { boards } = useBoardMeta()
  const joinBoardMutation = useJoinBoard()
  const handledRef = useRef(false)
  const userId = session?.user?.id ?? ''

  useEffect(() => {
    if (!ONBOARDING_CONFIG.enabled || status !== 'authenticated' || !userId || handledRef.current) {
      return
    }

    if (hasConscripted(userId)) {
      handledRef.current = true
      return
    }

    // Already a real (non-fallback) member of Global? Nothing to do.
    const alreadyMember = boards.some((board) => isGlobalBoardId(board.id) && !board.isFallback)

    if (alreadyMember) {
      handledRef.current = true
      markConscripted(userId)
      return
    }

    handledRef.current = true

    joinBoardMutation
      .mutateAsync(ONBOARDING_CONFIG.dropBoardInviteCode)
      .then(() => markConscripted(userId))
      .catch(() => {
        // Join failed (offline, RPC not ready) — the Global fallback still
        // shows the board, and we retry next session. Allow re-attempt.
        handledRef.current = false
      })
  }, [boards, joinBoardMutation, status, userId])

  return null
}

export { GLOBAL_BOARD_ID }
