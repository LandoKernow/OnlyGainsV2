import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { useToast } from '../../components/ToastProvider'
import { useAuth } from '../../features/auth/AuthProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { getBoardJoinErrorCopy, useBoardInvitePreview, useJoinBoard } from '../../hooks/useBoards'
import {
  clearPendingBoardInviteCode,
  formatBoardTypeLabel,
  getPendingBoardInviteCode,
  setPendingBoardInviteCode,
} from '../../utils/boardInvites'

function JoinBoardContent() {
  const { inviteCode = '' } = useParams()
  const normalizedInviteCode = String(inviteCode || '').trim()
  const navigate = useNavigate()
  const { status } = useAuth()
  const { setActiveBoardId } = useBoardMeta()
  const { showToast } = useToast()
  const previewQuery = useBoardInvitePreview(normalizedInviteCode)
  const joinMutation = useJoinBoard()
  const [joinState, setJoinState] = useState('')
  const autoJoinTriggeredRef = useRef(false)

  async function joinBoard() {
    const joinedBoard = await joinMutation.mutateAsync(normalizedInviteCode)
    const isExistingMember =
      joinedBoard?.alreadyMember ||
      joinedBoard?.membershipStatus === 'existing' ||
      joinedBoard?.membershipStatus === 'already_member'

    if (joinedBoard?.id) {
      setActiveBoardId(joinedBoard.id)
    }

    clearPendingBoardInviteCode()
    setJoinState(isExistingMember ? 'existing' : 'joined')
    showToast({
      tone: 'success',
      message: isExistingMember ? 'Already on this board.' : "You're on the board.",
    })
  }

  useEffect(() => {
    if (status !== 'authenticated' || autoJoinTriggeredRef.current || !normalizedInviteCode || previewQuery.isLoading) {
      return
    }

    if (getPendingBoardInviteCode() !== normalizedInviteCode) {
      return
    }

    autoJoinTriggeredRef.current = true
    joinBoard().catch((error) => {
      showToast({
        tone: 'error',
        message: getBoardJoinErrorCopy(error),
      })
    })
  }, [normalizedInviteCode, previewQuery.isLoading, showToast, status])

  async function handleJoinClick() {
    if (!normalizedInviteCode) {
      showToast({ tone: 'error', message: 'Invite code missing.' })
      return
    }

    if (status !== 'authenticated') {
      setPendingBoardInviteCode(normalizedInviteCode)
      navigate('/dashboard')
      return
    }

    try {
      await joinBoard()
    } catch (error) {
      showToast({
        tone: 'error',
        message: getBoardJoinErrorCopy(error),
      })
    }
  }

  return (
    <div className="screen screen--board-stage">
      {previewQuery.isLoading ? (
        <Card title="THIS BOARD IS LIVE" body="Loading the board.">
          <p className="muted">Scan. Join. Get ranked.</p>
        </Card>
      ) : previewQuery.error ? (
        <Card title="BOARD OFFLINE" body="Could not load this board right now.">
          <p className="muted">The board proof is not reachable yet.</p>
          <Link className="button button--ghost" to="/dashboard">
            Back to Board
          </Link>
        </Card>
      ) : !previewQuery.board ? (
        <Card title="BOARD UNAVAILABLE" body="That invite code did not open a live board.">
          <p className="muted">Check the link or ask for a fresh invite.</p>
        </Card>
      ) : (
        <div className="board-stage">
          <article className="board-stage__card">
            <p className="eyebrow">ONLY GAINS</p>
            <h2 className="board-stage__title">THIS BOARD IS LIVE</h2>
            <p className="board-stage__name">{previewQuery.board.name}</p>
            <p className="board-stage__meta">{formatBoardTypeLabel(previewQuery.board.boardType)}</p>
            <p className="board-stage__copy">Scan. Join. Get ranked.</p>
            <p className="board-stage__microcopy">No hiding now. Log first. Talk later.</p>
          </article>

          {joinState ? (
            <Card title={joinState === 'existing' ? 'Already on this board.' : "You're on the board."} body="Bring better enemies.">
              <div className="board-stage__actions board-stage__actions--stacked">
                <Link className="button board-stage__primary" to="/dashboard">
                  Log your first set
                </Link>
                <div className="board-stage__secondary">
                  <Link className="button button--ghost board-stage__secondary-button" to="/leaderboard">
                    View Board
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <div className="board-stage__actions board-stage__actions--stacked">
              <button
                className="button board-stage__primary"
                type="button"
                disabled={joinMutation.isPending}
                onClick={handleJoinClick}
              >
                {joinMutation.isPending ? 'Joining...' : 'Join this board'}
              </button>
              <div className="board-stage__secondary">
                <Link className="button button--ghost board-stage__secondary-button" to="/leaderboard">
                  View Board
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function JoinBoardScreen() {
  return <JoinBoardContent />
}
