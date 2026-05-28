import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { useToast } from '../../components/ToastProvider'
import { useBoardInviteDetails } from '../../hooks/useBoards'
import { buildBoardInviteQrUrl, buildBoardInviteUrl, formatBoardTypeLabel, shareBoardInvite } from '../../utils/boardInvites'

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()

  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }

  return Promise.resolve()
}

function BoardInviteContent() {
  const { boardId = '' } = useParams()
  const { showToast } = useToast()
  const boardQuery = useBoardInviteDetails(boardId)
  const board = boardQuery.board
  const inviteUrl = board?.inviteCode ? buildBoardInviteUrl(board.inviteCode) : ''
  const qrUrl = board?.inviteCode ? buildBoardInviteQrUrl(board.inviteCode) : ''

  async function handleShare() {
    if (!board?.inviteCode) {
      return
    }

    try {
      const result = await shareBoardInvite(board)

      if (result === 'cancelled') {
        return
      }

      showToast({
        tone: 'success',
        message: result === 'shared' ? 'Invite shared.' : 'Invite link copied.',
      })
    } catch {
      showToast({ tone: 'error', message: 'Could not share board invite.' })
    }
  }

  async function handleCopyLink() {
    if (!inviteUrl) {
      return
    }

    try {
      await copyText(inviteUrl)
      showToast({ tone: 'success', message: 'Invite link copied.' })
    } catch {
      showToast({ tone: 'error', message: 'Could not copy invite link.' })
    }
  }

  return (
    <div className="screen screen--board-stage">
      {boardQuery.isLoading ? (
        <Card title="THIS BOARD IS LIVE" body="Loading the invite line.">
          <p className="muted">Scan. Join. Get ranked.</p>
        </Card>
      ) : boardQuery.error ? (
        <Card title="INVITE OFFLINE" body="Board invite details could not load right now.">
          <p className="muted">The board is there. The invite layer is not ready yet.</p>
        </Card>
      ) : !board ? (
        <Card title="INVITE UNAVAILABLE" body="That board invite is not ready yet.">
          <p className="muted">Board creation can still work before the invite route is fully wired.</p>
        </Card>
      ) : (
        <div className="board-stage">
          <article className="board-stage__card">
            <p className="eyebrow">ONLY GAINS</p>
            <h2 className="board-stage__title">THIS BOARD IS LIVE</h2>
            <p className="board-stage__name">{board.name}</p>
            <p className="board-stage__meta">{formatBoardTypeLabel(board.boardType)}</p>
            {board.memberCount > 0 ? <p className="board-stage__member-count">{board.memberCount} on this board</p> : null}
            <p className="board-stage__copy">Scan. Join. Get ranked.</p>
            <p className="board-stage__microcopy">No hiding now.</p>
            {qrUrl ? (
              <div className="board-stage__qr-shell">
                <img className="board-stage__qr" src={qrUrl} alt={`QR code for ${inviteUrl}`} />
              </div>
            ) : null}
            {inviteUrl ? (
              <div className="board-stage__url-shell">
                <span className="muted">Invite link</span>
                <strong className="board-stage__url">{inviteUrl}</strong>
              </div>
            ) : null}
          </article>

          <div className="board-stage__actions board-stage__actions--stacked">
            <button className="button board-stage__primary" type="button" onClick={handleShare}>
              Share invite
            </button>
            <div className="board-stage__secondary">
              <button className="button button--ghost board-stage__secondary-button" type="button" onClick={handleCopyLink}>
                Copy link
              </button>
              {board.inviteCode ? (
                <Link className="button button--ghost board-stage__secondary-button" to={`/join/${encodeURIComponent(board.inviteCode)}`}>
                  Open join page
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BoardInviteScreen() {
  return <BoardInviteContent />
}
