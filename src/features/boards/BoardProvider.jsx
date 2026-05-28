import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { appEnv } from '../../lib/env'
import { useAuth } from '../auth/AuthProvider'
import { useMyBoards } from '../../hooks/useBoards'

const BoardContext = createContext(null)

function getFallbackBoard() {
  if (!appEnv.defaultCircleId) {
    return null
  }

  return {
    id: appEnv.defaultCircleId,
    name: 'Only Gains Beta',
    slug: 'only-gains-beta',
    inviteCode: '',
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

  return window.localStorage.getItem(getStorageKey(userId)) || ''
}

function writeStoredBoardId(userId, boardId) {
  if (typeof window === 'undefined') {
    return
  }

  const key = getStorageKey(userId)

  if (!boardId) {
    window.localStorage.removeItem(key)
    return
  }

  window.localStorage.setItem(key, boardId)
}

export function BoardProvider({ children }) {
  const { session, status } = useAuth()
  const fallbackBoard = useMemo(() => getFallbackBoard(), [])
  const myBoardsQuery = useMyBoards({
    enabled: status === 'authenticated' && Boolean(session?.user?.id),
  })
  const [activeBoardId, setActiveBoardIdState] = useState('')

  const boards = useMemo(() => {
    const nextBoards = [...myBoardsQuery.boards]

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

    if (appEnv.defaultCircleId && boardIds.includes(appEnv.defaultCircleId)) {
      setActiveBoardIdState(appEnv.defaultCircleId)
      return
    }

    setActiveBoardIdState(boards[0]?.id || '')
  }, [boards, session?.user?.id])

  function setActiveBoardId(nextBoardId) {
    const normalizedBoardId = String(nextBoardId || '').trim()
    setActiveBoardIdState(normalizedBoardId)
    writeStoredBoardId(session?.user?.id, normalizedBoardId)
  }

  function resolveFallbackBoardId(excludedBoardId = '') {
    const normalizedExcludedBoardId = String(excludedBoardId || '').trim()
    const nextBoards = boards.filter((board) => board.id !== normalizedExcludedBoardId)

    if (appEnv.defaultCircleId && nextBoards.some((board) => board.id === appEnv.defaultCircleId)) {
      return appEnv.defaultCircleId
    }

    return nextBoards[0]?.id || fallbackBoard?.id || appEnv.defaultCircleId || ''
  }

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
    [activeBoard, boards, myBoardsQuery.error, myBoardsQuery.featureReady, myBoardsQuery.isLoading, resolveFallbackBoardId],
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
