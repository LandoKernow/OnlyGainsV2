import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { appEnv } from '../../lib/env'
import { useAuth } from '../auth/AuthProvider'
import { useMyBoards } from '../../hooks/useBoards'
import { GLOBAL_BOARD_ID, GLOBAL_BOARD_NAME } from '../../utils/boards'

const BoardContext = createContext(null)

function getFallbackBoard() {
  if (!appEnv.defaultCircleId) {
    return null
  }

  return {
    id: appEnv.defaultCircleId,
    name: GLOBAL_BOARD_NAME,
    slug: 'only-gains-beta',
    inviteCode: 'GLOBAL',
    createdBy: '',
    createdAt: '',
    boardType: 'group',
    isPublic: true,
    role: 'member',
    joinedAt: '',
    memberCount: 0,
    membershipStatus: '',
    alreadyMember: true,
    isFallback: true,
  }
}

function getStorageKey(userId) {
  return `only_gains_active_board_${userId || 'guest'}`
}

function readStoredBoardId(userId) {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.localStorage.getItem(getStorageKey(userId)) || ''
  } catch {
    return ''
  }
}

function writeStoredBoardId(userId, boardId) {
  if (typeof window === 'undefined') {
    return
  }

  const key = getStorageKey(userId)

  // Restrictive storage (private mode, locked-down webviews) must never break
  // a board switch — the choice just won't survive a reload.
  try {
    if (!boardId) {
      window.localStorage.removeItem(key)
      return
    }

    window.localStorage.setItem(key, boardId)
  } catch {
    // Ignore.
  }
}

export function BoardProvider({ children }) {
  const { session, status } = useAuth()
  const fallbackBoard = useMemo(() => getFallbackBoard(), [])
  const myBoardsQuery = useMyBoards({
    enabled: status === 'authenticated' && Boolean(session?.user?.id),
  })
  const [activeBoardId, setActiveBoardIdState] = useState('')

  const boards = useMemo(() => {
    const dedupedBoards = []
    const seenBoardIds = new Set()

    for (const board of myBoardsQuery.boards) {
      const boardId = String(board?.id || '').trim()

      if (!boardId || seenBoardIds.has(boardId)) {
        continue
      }

      seenBoardIds.add(boardId)
      dedupedBoards.push(board)
    }

    const nextBoards = [...dedupedBoards]

    if (fallbackBoard && !nextBoards.some((board) => board.id === fallbackBoard.id)) {
      nextBoards.unshift(fallbackBoard)
    }

    return nextBoards
  }, [fallbackBoard, myBoardsQuery.boards])

  useEffect(() => {
    const storedBoardId = readStoredBoardId(session?.user?.id)
    const boardIds = boards.map((board) => board.id)

    if (storedBoardId && boardIds.includes(storedBoardId)) {
      setActiveBoardIdState(storedBoardId)
      return
    }

    if (GLOBAL_BOARD_ID && boardIds.includes(GLOBAL_BOARD_ID)) {
      setActiveBoardIdState(GLOBAL_BOARD_ID)
      return
    }

    setActiveBoardIdState(boards[0]?.id || '')
  }, [boards, session?.user?.id])

  const userId = session?.user?.id

  // Stable callbacks: the context value below only changes when the boards or
  // the active board actually change, so every useBoard() consumer (the whole
  // app) isn't re-rendered on unrelated provider renders.
  const setActiveBoardId = useCallback(
    (nextBoardId) => {
      const normalizedBoardId = String(nextBoardId || '').trim()
      setActiveBoardIdState(normalizedBoardId)
      writeStoredBoardId(userId, normalizedBoardId)
    },
    [userId],
  )

  const resolveFallbackBoardId = useCallback(
    (excludedBoardId = '') => {
      const normalizedExcludedBoardId = String(excludedBoardId || '').trim()
      const nextBoards = boards.filter((board) => board.id !== normalizedExcludedBoardId)

      if (GLOBAL_BOARD_ID && nextBoards.some((board) => board.id === GLOBAL_BOARD_ID)) {
        return GLOBAL_BOARD_ID
      }

      return nextBoards[0]?.id || fallbackBoard?.id || appEnv.defaultCircleId || ''
    },
    [boards, fallbackBoard],
  )

  const activeBoard =
    boards.find((board) => board.id === activeBoardId) ||
    boards[0] ||
    fallbackBoard ||
    null

  const value = useMemo(
    () => ({
      circleId: activeBoard?.id || appEnv.defaultCircleId,
      activeBoard,
      boards,
      boardFeatureReady: myBoardsQuery.featureReady,
      isBoardsLoading: myBoardsQuery.isLoading,
      isBoardsError: Boolean(myBoardsQuery.error),
      setActiveBoardId,
      resolveFallbackBoardId,
      timezone: 'Europe/London',
      appName: appEnv.appName,
    }),
    [
      activeBoard,
      boards,
      myBoardsQuery.error,
      myBoardsQuery.featureReady,
      myBoardsQuery.isLoading,
      resolveFallbackBoardId,
      setActiveBoardId,
    ],
  )

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}

export function useBoard() {
  const value = useContext(BoardContext)

  if (!value) {
    return {
      circleId: appEnv.defaultCircleId,
      activeBoard: getFallbackBoard(),
      boards: getFallbackBoard() ? [getFallbackBoard()] : [],
      boardFeatureReady: false,
      isBoardsLoading: false,
      isBoardsError: false,
      setActiveBoardId: () => {},
      resolveFallbackBoardId: () => appEnv.defaultCircleId || '',
      timezone: 'Europe/London',
      appName: appEnv.appName,
    }
  }

  return value
}
