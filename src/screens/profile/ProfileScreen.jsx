import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { ProfileBasicsCard } from '../../features/profile/ProfileBasicsCard'
import { useAuth } from '../../features/auth/AuthProvider'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { useProfileYearSetup } from '../../hooks/useProfileYearSetup'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useAdminAwardFinalization, getAdminAwardFinalizationErrorCopy } from '../../hooks/useAdminAwardFinalization'
import { useToast } from '../../components/ToastProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useActivityLeaderboard } from '../../hooks/useActivityLeaderboard'
import { useChase } from '../../hooks/useChase'
import { getBoardCreateErrorCopy, getBoardJoinErrorCopy, getBoardLeaveErrorCopy, useCreateBoard, useJoinBoard, useLeaveBoard } from '../../hooks/useBoards'
import { formatActivityGap, formatActivityValue } from '../../utils/activity'
import { getRowStatus, getStatusTone } from '../../utils/status'
import { getLondonPeriodKeys } from '../../utils/dates'
import { formatAwardPeriodRange } from '../../utils/awardShare'
import {
  BASIC_NON_GLOBAL_BOARD_LIMIT,
  countNonGlobalBoards,
  getBoardDisplayName,
  getBoardDisplayTypeLabel,
  GLOBAL_BOARD_ID,
  isGlobalBoard,
} from '../../utils/boards'

const BOARD_TYPE_OPTIONS = [
  { value: 'gym', label: 'Gym' },
  { value: 'workplace', label: 'Workplace' },
  { value: 'football_team', label: 'Football team' },
  { value: 'team_club', label: 'Team / club' },
  { value: 'group_chat', label: 'Group chat' },
  { value: 'other', label: 'Other' },
]
function boardDebug(step, details) {
  if (!import.meta.env.DEV) {
    return
  }

  console.debug('[Only Gains Board Debug]', step, details)
}

function ProfileSummary() {
  const { session, signOut } = useAuth()
  const { circleId } = useBoardMeta()
  const profileQuery = useCurrentProfile()
  const profileYearSetup = useProfileYearSetup(2026)
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    currentUserId: session?.user?.id,
    period: 'weekly',
    activityType: 'pressups',
  })
  const chase = useChase(leaderboardQuery.rows, session?.user?.id, 'pressups')
  const profileName = profileQuery.data?.name || session?.user?.email?.split('@')[0] || 'Warrior'
  const currentRow = leaderboardQuery.currentUserRow
  const statusLabel = currentRow ? getRowStatus(currentRow, leaderboardQuery.rows, 'pressups') : 'QUIET'
  const rivalRow = chase.rowAbove || chase.rowBelow
  const recordCount = profileYearSetup.recordEntries.length
  const profileYearState = !profileYearSetup.profileYear
    ? 'NOT STARTED'
    : profileYearSetup.profileYear.setupStatus === 'claimed'
      ? 'CLAIMED'
      : 'IN PROGRESS'
  const rivalCopy = chase.rowAbove && chase.gapToCatch != null
    ? `${rivalRow?.actorName || 'Unknown'} - ${formatActivityGap(chase.gapToCatch, 'pressups')} to take the spot`
    : chase.rowBelow && chase.gapToDefend != null
      ? `${rivalRow?.actorName || 'Unknown'} - ${formatActivityGap(chase.gapToDefend, 'pressups')} off your back`
      : 'No immediate rival.'

  return (
    <>
      <Card title="Who you're becoming" body="The year is being written.">
        <div className="stack">
          <div className="stat-strip">
            <strong>{profileName}</strong>
            <span>{currentRow ? `#${currentRow.rank} this week` : 'No weekly rank yet'}</span>
          </div>

          {leaderboardQuery.isLoading || profileQuery.isLoading ? (
            <p className="muted">Loading board identity...</p>
          ) : currentRow ? (
            <div className="stack section-gap">
              <div className="stat-strip">
                <span>{formatActivityValue(currentRow.total, 'pressups')} this week</span>
                <span>{recordCount} records claimed</span>
              </div>
              <div className="profile-identity-grid">
                <div className="profile-identity-grid__row">
                  <span className="muted">Board status</span>
                  <strong>{statusLabel}</strong>
                </div>
                <div className="profile-identity-grid__row">
                  <span className="muted">Current rival</span>
                  <strong>{rivalCopy}</strong>
                </div>
                <div className="profile-identity-grid__row">
                  <span className="muted">2026 profile</span>
                  <strong>{profileYearState}</strong>
                </div>
              </div>
              <div className="row-chip-list">
                <span className={`row-chip row-chip--${getStatusTone(statusLabel)}`}>{statusLabel}</span>
                {currentRow.todayTotal > 0 ? <span className="row-chip">ACTIVE TODAY</span> : null}
              </div>
            </div>
          ) : (
            <div className="stack">
              <strong>Not yet on the board.</strong>
              <span>Log press-up activity to make yourself visible.</span>
            </div>
          )}

          <p className="muted">Arena returning. Profiles expanding. The year is being written.</p>
          <div className="profile-summary-actions">
            <button className="button button--ghost" type="button" onClick={() => signOut()}>
              Sign out
            </button>
            <FeedbackActions />
          </div>
        </div>
      </Card>
      {import.meta.env.DEV ? (
        <details className="build-info">
          <summary>Dev info</summary>
          <div className="stack">
            <p className="muted">Origin: {window.location.origin}</p>
            <p className="muted">Auth target: {`${window.location.origin}/dashboard`}</p>
          </div>
        </details>
      ) : null}
    </>
  )
}

function VaultProfileCard() {
  return (
    <Card title="Vault records" body="Claimed records are visible. Verified records are coming.">
      <div className="stack">
        <p className="muted">The Vault remembers what the Board forgets.</p>
        <Link className="button" to="/vault">
          Enter the Vault
        </Link>
      </div>
    </Card>
  )
}

function PersonalRecordsEntryCard() {
  return (
    <Card title="Personal Records" body="Your best work is on record.">
      <div className="stack">
        <p className="muted">Break this. Update the mark.</p>
        <Link className="button" to="/profile/records">
          View your records
        </Link>
      </div>
    </Card>
  )
}

function ProfileYearEntryCard() {
  const profileYearSetup = useProfileYearSetup(2026)
  const profileYear = profileYearSetup.profileYear
  const recordCount = profileYearSetup.recordEntries.length
  const title = !profileYear
    ? 'Build your 2026 profile'
    : '2026 profile'
  const statusLabel = !profileYear
    ? 'Not started'
    : profileYear.setupStatus === 'claimed'
      ? 'Claimed'
      : 'In progress'

  if (profileYearSetup.isLoading) {
    return (
      <Card title="Build your 2026 profile" body="Claim records. Add yearly totals. Power the Vault.">
        <p className="muted">Loading your year setup.</p>
      </Card>
    )
  }

  if (profileYearSetup.error) {
    return (
      <Card title="Build your 2026 profile" body="Claim records. Add yearly totals. Power the Vault.">
        <p className="muted">Could not load year setup yet.</p>
        <Link className="button" to="/profile/year/2026">
          Build your year
        </Link>
      </Card>
    )
  }

  return (
    <Card title={title} body="Claim your records. Power the Vault.">
      <div className="stack">
        <div className="stat-strip">
          <span>{statusLabel}</span>
          <span>{recordCount} records claimed</span>
        </div>
        <p className="muted">The Board is earned live. The Profile remembers the year.</p>
        <Link className="button" to="/profile/year/2026">
          Build your year
        </Link>
      </div>
    </Card>
  )
}

function BoardsCard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const {
    activeBoard,
    boards,
    boardFeatureReady,
    isBoardsLoading,
    setActiveBoardId,
    resolveFallbackBoardId,
  } = useBoardMeta()
  const createBoardMutation = useCreateBoard()
  const joinBoardMutation = useJoinBoard()
  const leaveBoardMutation = useLeaveBoard()
  const [boardName, setBoardName] = useState('')
  const [boardType, setBoardType] = useState('gym')
  const [inviteCode, setInviteCode] = useState('')
  const [leaveTargetBoard, setLeaveTargetBoard] = useState(null)
  const nonGlobalBoardCount = countNonGlobalBoards(boards)
  const hasReachedBoardLimit = nonGlobalBoardCount >= BASIC_NON_GLOBAL_BOARD_LIMIT

  async function handleCreateBoard(event) {
    event.preventDefault()

    const trimmedBoardName = boardName.trim()

    if (!trimmedBoardName) {
      showToast({ tone: 'error', message: 'Name the board.' })
      return
    }

    if (hasReachedBoardLimit) {
      showToast({
        tone: 'error',
        message: 'Board limit hit. Global is always open. Choose your wars carefully.',
      })
      return
    }

    try {
      const createdBoard = await createBoardMutation.mutateAsync({
        name: trimmedBoardName,
        boardType,
      })

      if (createdBoard?.id) {
        setActiveBoardId(createdBoard.id)
      }

      setBoardName('')
      showToast({ tone: 'success', message: 'Board created.' })

      if (createdBoard?.id) {
        navigate(`/boards/${createdBoard.id}/invite`)
      }
    } catch (error) {
      showToast({
        tone: 'error',
        message: getBoardCreateErrorCopy(error),
      })
    }
  }

  async function handleJoinBoard(event) {
    event.preventDefault()

    const trimmedInviteCode = inviteCode.trim()

    if (!trimmedInviteCode) {
      showToast({ tone: 'error', message: 'Enter an invite code.' })
      return
    }

    if (hasReachedBoardLimit && trimmedInviteCode.toUpperCase() !== 'GLOBAL') {
      showToast({
        tone: 'error',
        message: 'Board limit hit. Global is always open. Choose your wars carefully.',
      })
      return
    }

    try {
      const joinedBoard = await joinBoardMutation.mutateAsync(trimmedInviteCode)
      const isExistingMember =
        joinedBoard?.alreadyMember ||
        joinedBoard?.membershipStatus === 'existing' ||
        joinedBoard?.membershipStatus === 'already_member'

      if (joinedBoard?.id) {
        setActiveBoardId(joinedBoard.id)
      }

      setInviteCode('')
      showToast({
        tone: 'success',
        message: isExistingMember ? 'Already on this board.' : "You're on the board.",
      })
    } catch (error) {
      showToast({
        tone: 'error',
        message: getBoardJoinErrorCopy(error),
      })
    }
  }

  function handleSwitchBoard(boardId) {
    setActiveBoardId(boardId)
    showToast({ tone: 'success', message: 'Board switched.' })
  }

  function handleRequestLeave(board) {
      boardDebug('leave clicked', {
        boardId: board?.id ?? null,
        boardName: board?.name ?? null,
        isGlobalBoard: board?.id === GLOBAL_BOARD_ID,
      })

    if (board.id === GLOBAL_BOARD_ID) {
      showToast({ tone: 'error', message: 'The Global Board stays with you.' })
      return
    }

    setLeaveTargetBoard(board)
    boardDebug('leave confirmation opened', {
      boardId: board?.id ?? null,
      boardName: board?.name ?? null,
    })
  }

  async function handleConfirmLeaveBoard() {
    if (!leaveTargetBoard?.id) {
      boardDebug('confirm leave clicked without target', {})
      return
    }

    boardDebug('confirm leave clicked', {
      boardId: leaveTargetBoard.id,
      boardName: leaveTargetBoard.name,
    })

    try {
      const result = await leaveBoardMutation.mutateAsync(leaveTargetBoard.id)
      const status = String(result?.status || '').toLowerCase()
      const fallbackBoardId = String(result?.fallback_board_id || '').trim()
      const nextBoardId = fallbackBoardId || resolveFallbackBoardId(leaveTargetBoard.id)

      boardDebug('leave response received', {
        boardId: leaveTargetBoard.id,
        result,
        nextBoardId,
      })

      if (activeBoard?.id === leaveTargetBoard.id && nextBoardId) {
        setActiveBoardId(nextBoardId)
      }

      setLeaveTargetBoard(null)
      showToast({
        tone: 'success',
        message: status === 'deleted' ? 'Board deleted.' : 'Board left.',
      })
    } catch (error) {
      boardDebug('leave error surfaced', {
        boardId: leaveTargetBoard.id,
        code: error?.code ?? null,
        message: error?.message ?? null,
      })

      showToast({
        tone: 'error',
        message: getBoardLeaveErrorCopy(error),
      })
    }
  }

  return (
    <Card title="BOARDS" body="Your boards. Your wars.">
      <div className="stack">
        <div className="profile-identity-grid">
          <div className="profile-identity-grid__row">
            <span className="muted">Active board</span>
            <strong>{getBoardDisplayName(activeBoard)}</strong>
          </div>
          <div className="profile-identity-grid__row">
            <span className="muted">Board type</span>
            <strong>{getBoardDisplayTypeLabel(activeBoard)}</strong>
          </div>
        </div>

        <div className="stat-strip">
          <span>{nonGlobalBoardCount}/{BASIC_NON_GLOBAL_BOARD_LIMIT} boards used</span>
          <span>Global Board stays open</span>
        </div>

        {hasReachedBoardLimit ? (
          <div className="board-limit-note">
            <strong>TWO WARS IS ENOUGH FOR NOW.</strong>
            <p className="muted">You have Global plus 2 boards. Finish what you started.</p>
          </div>
        ) : null}

        {activeBoard?.id && boardFeatureReady ? (
          <div className="profile-summary-actions">
            <Link className="button button--ghost" to={`/boards/${activeBoard.id}/invite`}>
              Share invite
            </Link>
          </div>
        ) : null}

        {isBoardsLoading ? <p className="muted">Loading boards...</p> : null}
        {!boardFeatureReady ? <p className="muted">Board invites wake up when the new board SQL is live.</p> : null}

        {boards.length > 1 ? (
          <div className="board-switcher-list">
            {boards.map((board) => {
              const isActive = board.id === activeBoard?.id

              return (
                <div key={board.id} className={isActive ? 'board-switcher-row board-switcher-row--active' : 'board-switcher-row'}>
                  <div className="board-switcher-row__meta">
                    <strong>{getBoardDisplayName(board)}</strong>
                    <span>{getBoardDisplayTypeLabel(board)}</span>
                  </div>
                  <div className="board-switcher-row__actions">
                    {isActive ? (
                      <span className="row-chip row-chip--accent">LIVE</span>
                    ) : (
                      <button className="button button--ghost board-switcher-row__button" type="button" onClick={() => handleSwitchBoard(board.id)}>
                        Set active
                      </button>
                    )}
                    {!isGlobalBoard(board) ? (
                      <button className="board-switcher-row__leave button button--ghost" type="button" onClick={() => handleRequestLeave(board)}>
                        Leave
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted">Your current board stays live here. Create the next one or join another war below.</p>
        )}

        <form className="board-form" onSubmit={handleCreateBoard}>
          <div className="board-form__header">
            <strong>Create board</strong>
            <span className="muted">Your gym. Your team. Your war.</span>
          </div>
          <label className="stack">
            <span>Board name</span>
            <input
              className="input"
              type="text"
              value={boardName}
              onChange={(event) => setBoardName(event.target.value)}
              placeholder="Warehouse Warriors"
              maxLength={80}
            />
          </label>
          <label className="stack">
            <span>Board type</span>
            <select className="input" value={boardType} onChange={(event) => setBoardType(event.target.value)}>
              {BOARD_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit" disabled={createBoardMutation.isPending}>
            {createBoardMutation.isPending ? 'Creating...' : hasReachedBoardLimit ? 'Board limit hit' : 'Create board'}
          </button>
        </form>

        <form className="board-form" onSubmit={handleJoinBoard}>
          <div className="board-form__header">
            <strong>Join board</strong>
            <span className="muted">Got a link or code? Step in.</span>
          </div>
          <label className="stack">
            <span>Invite code</span>
            <input
              className="input"
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="OG-WAREHOUSE"
              autoCapitalize="characters"
              autoCorrect="off"
            />
          </label>
          <button className="button button--ghost" type="submit" disabled={joinBoardMutation.isPending || hasReachedBoardLimit}>
            {joinBoardMutation.isPending ? 'Joining...' : hasReachedBoardLimit ? 'Board limit hit' : 'Join board'}
          </button>
        </form>

      </div>
      {leaveTargetBoard ? (
        <div className="board-leave-modal" role="dialog" aria-modal="true" aria-labelledby="leave-board-title">
          <div className="board-leave-modal__backdrop" onClick={() => setLeaveTargetBoard(null)} />
          <div className="board-leave-modal__card">
            <strong id="leave-board-title">LEAVE BOARD?</strong>
            <p className="muted">This board stops counting for you. Your work stays where it was written.</p>
            <p className="muted">You are leaving {leaveTargetBoard.name}. If you are the last one here, this board dies with you.</p>
            <div className="profile-summary-actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => {
                  boardDebug('leave confirmation closed', {
                    boardId: leaveTargetBoard.id,
                    reason: 'stay',
                  })
                  setLeaveTargetBoard(null)
                }}
              >
                Stay
              </button>
              <button className="button board-leave-confirm__button" type="button" disabled={leaveBoardMutation.isPending} onClick={handleConfirmLeaveBoard}>
                {leaveBoardMutation.isPending ? 'Leaving...' : 'Leave board'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function getLastCompletedWeekStart() {
  const { weekKey } = getLondonPeriodKeys(new Date())
  const weekStart = new Date(`${weekKey}T12:00:00.000Z`)
  weekStart.setUTCDate(weekStart.getUTCDate() - 7)
  return weekStart.toISOString().slice(0, 10)
}

function getLastCompletedMonthStart() {
  const { monthKey } = getLondonPeriodKeys(new Date())
  const monthStart = new Date(`${monthKey}-01T12:00:00.000Z`)
  monthStart.setUTCMonth(monthStart.getUTCMonth() - 1)
  return monthStart.toISOString().slice(0, 10)
}

function AdminAwardControls() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { circleId } = useBoardMeta()
  const { showToast } = useToast()
  const isAdminQuery = useIsAdmin()
  const finalizeMutation = useAdminAwardFinalization(circleId)

  const lastWeekStart = getLastCompletedWeekStart()
  const lastMonthStart = getLastCompletedMonthStart()
  const lastWeekLabel = formatAwardPeriodRange({
    periodType: 'weekly',
    periodStart: lastWeekStart,
    periodEnd: new Date(new Date(`${lastWeekStart}T12:00:00.000Z`).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  })
  const lastMonthLabel = formatAwardPeriodRange({
    periodType: 'monthly',
    periodStart: lastMonthStart,
  })

  if (!isAdminQuery.isAdmin) {
    return null
  }

  async function handleFinalize(periodType, periodStart) {
    try {
      const rows = await finalizeMutation.mutateAsync({
        circleId,
        periodType,
        periodStart,
      })

      showToast({
        tone: 'success',
        message: rows.length > 0 ? 'Awards finalised.' : 'No completed awards found.',
      })
    } catch (error) {
      showToast({
        tone: 'error',
        message: getAdminAwardFinalizationErrorCopy(error),
      })
    }
  }

  return (
    <Card title="ADMIN" body="Finalise awards." className="admin-tools-card">
      <div className="stack">
        <button
          className="admin-tools-toggle"
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <span>ADMIN TOOLS</span>
          <span aria-hidden="true">{isExpanded ? '▴' : '▾'}</span>
        </button>
        {isExpanded ? (
          <div className="stack">
            <p className="muted">Finalise awards.</p>
            <div className="profile-identity-grid">
              <div className="profile-identity-grid__row">
                <span className="muted">Last completed week</span>
                <strong>{lastWeekLabel}</strong>
              </div>
              <button
                className="button"
                type="button"
                disabled={finalizeMutation.isPending}
                onClick={() => handleFinalize('weekly', lastWeekStart)}
              >
                {finalizeMutation.isPending ? 'Finalising...' : 'Finalise last week'}
              </button>
              <div className="profile-identity-grid__row">
                <span className="muted">Last completed month</span>
                <strong>{lastMonthLabel}</strong>
              </div>
              <button
                className="button"
                type="button"
                disabled={finalizeMutation.isPending}
                onClick={() => handleFinalize('monthly', lastMonthStart)}
              >
                {finalizeMutation.isPending ? 'Finalising...' : 'Finalise last month'}
              </button>
            </div>
            <Link className="button button--ghost" to="/admin/awards">
              Manual SQL helper
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function FeedbackActions() {
  const { showToast } = useToast()

  function copyTemplate() {
    const template = 'Only Gains 2.0 feedback:\nDevice:\nBrowser:\nWhat happened:\nScreenshot attached? Yes/No'

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(template).then(() => {
        showToast({ tone: 'success', message: 'Feedback template copied.' })
      })
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = template
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        showToast({ tone: 'success', message: 'Feedback template copied.' })
      } catch {
        showToast({ tone: 'error', message: 'Could not copy feedback template.' })
      }
      document.body.removeChild(textarea)
    }
  }

  return (
    <div>
      <button className="button button--ghost" type="button" onClick={copyTemplate}>
        Report issue
      </button>
    </div>
  )
}

export default function ProfileScreen() {
  return (
    <div className="screen screen--profile">
      <AuthGate>
        <div className="stack-lg">
          <ProfileSummary />
          <BoardsCard />
          <AdminAwardControls />
          <ProfileYearEntryCard />
          <PersonalRecordsEntryCard />
          <VaultProfileCard />
          <ProfileBasicsCard />
        </div>
      </AuthGate>
    </div>
  )
}
