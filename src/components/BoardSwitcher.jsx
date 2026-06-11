import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './ToastProvider'
import { useBoardMeta } from '../hooks/useBoardMeta'
import { getBoardDisplayName, getBoardDisplayTypeLabel } from '../utils/boards'
import { getToastMessage } from '../utils/toastCopy'
import { useEscapeKey } from '../hooks/useEscapeKey'

export function BoardSwitcher() {
  const { activeBoard, boards, setActiveBoardId } = useBoardMeta()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  useEscapeKey(() => setIsOpen(false), isOpen)

  if (boards.length <= 1) {
    return null
  }

  function handleSelectBoard(boardId) {
    setActiveBoardId(boardId)
    setIsOpen(false)
    showToast({ tone: 'success', message: getToastMessage('board_switched') })
  }

  return (
    <>
      <div className="board-switcher-launch">
        <button className="board-switcher-launch__button" type="button" onClick={() => setIsOpen(true)}>
          <span>{getBoardDisplayName(activeBoard)}</span>
          <span aria-hidden="true">▾</span>
        </button>
      </div>

      {isOpen ? (
        <div className="board-selector-modal" role="dialog" aria-modal="true" aria-labelledby="board-selector-title">
          <div className="board-selector-modal__backdrop" onClick={() => setIsOpen(false)} />
          <div className="board-selector-modal__card">
            <strong id="board-selector-title">BOARDS</strong>
            <div className="board-selector-modal__group">
              <p className="eyebrow">ACTIVE</p>
              <div className="board-selector-modal__row board-selector-modal__row--active">
                <div>
                  <strong>{getBoardDisplayTypeLabel(activeBoard)}</strong>
                  <p className="muted">{getBoardDisplayName(activeBoard)}</p>
                </div>
                <span className="row-chip row-chip--accent">LIVE</span>
              </div>
            </div>

            <div className="board-selector-modal__group">
              <p className="eyebrow">YOUR BOARDS</p>
              <div className="board-selector-modal__list">
                {boards.map((board) => {
                  const isActive = board.id === activeBoard?.id

                  return (
                    <button
                      key={board.id}
                      className={isActive ? 'board-selector-modal__row board-selector-modal__row--active' : 'board-selector-modal__row'}
                      type="button"
                      onClick={() => handleSelectBoard(board.id)}
                      disabled={isActive}
                    >
                      <div>
                        <strong>{getBoardDisplayTypeLabel(board)}</strong>
                        <p className="muted">{getBoardDisplayName(board)}</p>
                      </div>
                      {!isActive ? <span className="muted">Set active</span> : <span className="row-chip row-chip--accent">LIVE</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <Link className="button button--ghost" to="/profile" onClick={() => setIsOpen(false)}>
              Manage boards
            </Link>
          </div>
        </div>
      ) : null}
    </>
  )
}
