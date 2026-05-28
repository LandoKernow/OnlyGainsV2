import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from './ToastProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { useBoardMeta } from '../hooks/useBoardMeta'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { getBoardJoinErrorCopy, useJoinBoard } from '../hooks/useBoards'
import { clearPendingBoardInviteCode, getPendingBoardInviteCode } from '../utils/boardInvites'
import { BASIC_NON_GLOBAL_BOARD_LIMIT, countNonGlobalBoards, GLOBAL_BOARD_ID, isGlobalBoardId } from '../utils/boards'
import { fetchBoardInvitePreview } from '../api/boards'

export function PendingBoardInviteWatcher() {
  const { status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { boards, setActiveBoardId } = useBoardMeta()
  const isAdminQuery = useIsAdmin()
  const joinBoardMutation = useJoinBoard()
  const { showToast } = useToast()
  const isHandlingRef = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || isHandlingRef.current || isAdminQuery.isLoading) {
      return
    }

    const inviteCode = getPendingBoardInviteCode()

    if (!inviteCode) {
      return
    }

    isHandlingRef.current = true

    async function completePendingInviteJoin() {
      try {
        const previewBoard = await fetchBoardInvitePreview(inviteCode)

        if (!previewBoard) {
          clearPendingBoardInviteCode()
          return
        }

        const alreadyMemberBoard = boards.find((board) => board.id === previewBoard.id)
        const isGlobal = isGlobalBoardId(previewBoard.id) || String(inviteCode).trim().toUpperCase() === 'GLOBAL'
        const nonGlobalBoardCount = countNonGlobalBoards(boards)
        const hasReachedLimit = !isAdminQuery.isAdmin && nonGlobalBoardCount >= BASIC_NON_GLOBAL_BOARD_LIMIT

        if (!alreadyMemberBoard && !isGlobal && hasReachedLimit) {
          clearPendingBoardInviteCode()
          showToast({
            tone: 'error',
            message: 'Board limit hit. Global is always open. Choose your wars carefully.',
          })
          navigate('/profile', { replace: true })
          return
        }

        const joinedBoard = await joinBoardMutation.mutateAsync(inviteCode)
        const isExistingMember =
          joinedBoard?.alreadyMember ||
          joinedBoard?.membershipStatus === 'existing' ||
          joinedBoard?.membershipStatus === 'already_member' ||
          joinedBoard?.id === alreadyMemberBoard?.id

        const targetBoardId = joinedBoard?.id || previewBoard.id || GLOBAL_BOARD_ID

        if (targetBoardId) {
          setActiveBoardId(targetBoardId)
        }

        clearPendingBoardInviteCode()
        showToast({
          tone: 'success',
          message: isExistingMember ? 'Already on this board.' : "You're on the board.",
        })

        if (!location.pathname.startsWith('/join/')) {
          navigate('/dashboard', { replace: true })
        }
      } catch (error) {
        clearPendingBoardInviteCode()
        showToast({
          tone: 'error',
          message: getBoardJoinErrorCopy(error),
        })
      } finally {
        isHandlingRef.current = false
      }
    }

    completePendingInviteJoin()
  }, [boards, isAdminQuery.isAdmin, isAdminQuery.isLoading, joinBoardMutation, location.pathname, navigate, setActiveBoardId, showToast, status])

  return null
}
