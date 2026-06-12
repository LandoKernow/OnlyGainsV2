import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { AlertSettingsCard } from '../../features/profile/AlertSettingsCard'
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
import { useCrownHonors } from '../../hooks/useCrownHonors'
import { useWarriorXp } from '../../hooks/useWarriorXp'
import { calculateStreak } from '../../utils/war'
import { getBoardCreateErrorCopy, getBoardJoinErrorCopy, getBoardLeaveErrorCopy, useCreateBoard, useJoinBoard, useLeaveBoard } from '../../hooks/useBoards'
import { formatActivityGap } from '../../utils/activity'
import { getRowStatus, getStatusTone } from '../../utils/status'
import { getLondonPeriodKeys } from '../../utils/dates'
import { formatAwardPeriodRange } from '../../utils/awardShare'
import { copyReportIssueTemplate, openAddToHomeScreenPrompt, TELEGRAM_URL } from '../../utils/community'
import { getToastMessage } from '../../utils/toastCopy'
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

// The warrior card: identity, rank, headline numbers, honors. Big numbers,
// tiny words — the three most impressive things land instantly.
function ProfileSummary() {
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const profileQuery = useCurrentProfile()
  const honors = useCrownHonors()
  const warriorLevel = useWarriorXp({ circleId, userId: session?.user?.id })
  const profileYearSetup = useProfileYearSetup(2026)
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    currentUserId: session?.user?.id,
    period: 'weekly',
    activityType: 'pressups',
  })
  const pullupsLeaderboardQuery = useActivityLeaderboard({
    circleId,
    currentUserId: session?.user?.id,
    period: 'weekly',
    activityType: 'pullups',
  })
  const chase = useChase(leaderboardQuery.rows, session?.user?.id, 'pressups')
  const pullupsRow = pullupsLeaderboardQuery.currentUserRow
  const profileName = profileQuery.data?.name || session?.user?.email?.split('@')[0] || 'Warrior'
  const currentRow = leaderboardQuery.currentUserRow
  const statusLabel = currentRow ? getRowStatus(currentRow, leaderboardQuery.rows, 'pressups') : 'QUIET'
  const rivalRow = chase.rowAbove || chase.rowBelow
  const streak = calculateStreak(leaderboardQuery.data ?? [], session?.user?.id)
  const recordCount = profileYearSetup.recordEntries.length
  const profileYearState = !profileYearSetup.profileYear
    ? 'NOT STARTED'
    : profileYearSetup.profileYear.setupStatus === 'claimed'
      ? 'CLAIMED'
      : 'IN PROGRESS'
  const rivalLine = chase.rowAbove && chase.gapToCatch != null
    ? `${(rivalRow?.actorName || 'UNKNOWN').toUpperCase()} +${formatActivityGap(chase.gapToCatch, 'pressups')}`
    : chase.rowBelow && chase.gapToDefend != null
      ? `${(rivalRow?.actorName || 'UNKNOWN').toUpperCase()} −${formatActivityGap(chase.gapToDefend, 'pressups')}`
      : 'NONE'

  return (
    <>
      <Card className="warrior-card">
        <div className="warrior-card__head">
          <div>
            <strong className="warrior-card__name">{profileName.toUpperCase()}</strong>
            {warriorLevel?.name ? (
              <span className="warrior-card__level">LVL {warriorLevel.level} {warriorLevel.name}</span>
            ) : null}
          </div>
          <span className={`row-chip row-chip--${getStatusTone(statusLabel)}`}>{statusLabel}</span>
        </div>

        {honors.totalCrowns > 0 ? (
          <div className="warrior-card__honors">
            {honors.trebleCount > 0 ? <span className="warrior-card__treble">{honors.trebleCount}x TREBLE WARRIOR</span> : null}
            {honors.doubleCount > 0 ? <span>{honors.doubleCount}x DOUBLE</span> : null}
            <span>👑 {honors.totalCrowns}</span>
          </div>
        ) : null}

        {leaderboardQuery.isLoading || profileQuery.isLoading ? (
          <p className="muted">Loading...</p>
        ) : (
          <div className="warrior-card__stats">
            <div className="warrior-stat">
              <strong className="warrior-stat__value">{currentRow ? `#${currentRow.rank}` : '—'}</strong>
              <span className="warrior-stat__label">RANK · WEEK</span>
            </div>
            <div className="warrior-stat">
              <strong className="warrior-stat__value">{currentRow ? Math.round(currentRow.total) : 0}</strong>
              <span className="warrior-stat__label">PRESS-UPS · WEEK</span>
            </div>
            <div className="warrior-stat">
              <strong className="warrior-stat__value">{streak.streakDays}{streak.streakDays > 0 ? '🔥' : ''}</strong>
              <span className="warrior-stat__label">DAY STREAK</span>
            </div>
          </div>
        )}

        <div className="profile-identity-grid warrior-card__grid">
          <div className="profile-identity-grid__row">
            <span className="muted">BAR WORK</span>
            <strong>{pullupsRow ? `${Math.round(pullupsRow.total)} · #${pullupsRow.rank}` : '0'}</strong>
          </div>
          <div className="profile-identity-grid__row">
            <span className="muted">RIVAL</span>
            <strong>{rivalLine}</strong>
          </div>
          <div className="profile-identity-grid__row">
            <span className="muted">2026 PROFILE</span>
            <strong>{profileYearState} · {recordCount} CLAIMED</strong>
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

// Sign out survives, demoted to a quiet footer at the bottom of the screen.
function SignOutFooter() {
  const { signOut } = useAuth()

  return (
    <div className="profile-summary-actions">
      <button className="button button--ghost" type="button" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  )
}

// One row, three doors. The taglines died for the cause.
function WarRecordLinksCard() {
  return (
    <Card title="WAR RECORD">
      <div className="war-record-links">
        <Link className="button button--ghost war-record-links__button" to="/profile/records">
          RECORDS
        </Link>
        <Link className="button button--ghost war-record-links__button" to="/profile/year/2026">
          2026 PROFILE
        </Link>
        <Link className="button button--ghost war-record-links__button" to="/vault">
          VAULT
        </Link>
      </div>
    </Card>
  )
}

function BoardsCard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isAdminQuery = useIsAdmin()
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
  const [showForms, setShowForms] = useState(false)
  const nonGlobalBoardCount = countNonGlobalBoards(boards)
  const isBoardLimitCheckPending = isAdminQuery.isLoading && !isAdminQuery.isAdmin
  const hasUnlimitedBoards = isAdminQuery.isAdmin
  const hasReachedBoardLimit = !isBoardLimitCheckPending && !hasUnlimitedBoards && nonGlobalBoardCount >= BASIC_NON_GLOBAL_BOARD_LIMIT

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
      showToast({ tone: 'success', message: getToastMessage('board_created', createdBoard?.id) })

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
        message: isExistingMember ? 'Already on this board.' : getToastMessage('board_joined', joinedBoard?.id),
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
    showToast({ tone: 'success', message: getToastMessage('board_switched') })
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
        message: status === 'deleted' ? 'Board deleted.' : getToastMessage('board_left'),
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
    <Card title="BOARDS" aside={<span className="muted">{hasUnlimitedBoards ? '∞' : `${nonGlobalBoardCount}/${BASIC_NON_GLOBAL_BOARD_LIMIT}`}</span>}>
      <div className="stack">
        <div className="profile-identity-grid">
          <div className="profile-identity-grid__row">
            <span className="muted">ACTIVE</span>
            <strong>{getBoardDisplayName(activeBoard)} · {getBoardDisplayTypeLabel(activeBoard)}</strong>
          </div>
        </div>

        {hasReachedBoardLimit ? (
          <p className="muted">TWO WARS IS ENOUGH. FINISH ONE.</p>
        ) : null}

        {activeBoard?.id && boardFeatureReady ? (
          <div className="profile-summary-actions">
            <Link className="button button--ghost" to={`/boards/${activeBoard.id}/invite`}>
              Share invite
            </Link>
          </div>
        ) : null}

        {isBoardsLoading ? <p className="muted">Loading...</p> : null}

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
        ) : null}

        <button
          className="button button--ghost"
          type="button"
          onClick={() => setShowForms((current) => !current)}
          aria-expanded={showForms}
        >
          {showForms ? 'CLOSE' : '+ NEW WAR'}
        </button>

        {showForms ? (
          <>
            <form className="board-form" onSubmit={handleCreateBoard}>
              <div className="board-form__header">
                <strong>Create board</strong>
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
              <button className="button" type="submit" disabled={createBoardMutation.isPending || hasReachedBoardLimit}>
                {createBoardMutation.isPending ? 'Creating...' : hasReachedBoardLimit ? 'Board limit hit' : 'Create board'}
              </button>
            </form>

            <form className="board-form" onSubmit={handleJoinBoard}>
              <div className="board-form__header">
                <strong>Join board</strong>
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
          </>
        ) : null}
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
            <Link className="button button--ghost" to="/dashboard?takeover=demo">
              Preview the macho takeover
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function HelpCommunityCard() {
  const { showToast } = useToast()

  async function handleReportIssue() {
    try {
      await copyReportIssueTemplate()
      showToast({ tone: 'success', message: 'Feedback template copied.' })
    } catch {
      showToast({ tone: 'error', message: 'Could not copy feedback template.' })
    }
  }

  return (
    <Card title="COMMS">
      <div className="war-record-links">
        <a className="button button--ghost war-record-links__button" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
          TELEGRAM
        </a>
        <button className="button button--ghost war-record-links__button" type="button" onClick={handleReportIssue}>
          REPORT
        </button>
        <button className="button button--ghost war-record-links__button" type="button" onClick={() => openAddToHomeScreenPrompt()}>
          INSTALL
        </button>
      </div>
    </Card>
  )
}

export default function ProfileScreen() {
  return (
    <div className="screen screen--profile">
      <AuthGate>
        <div className="stack-lg">
          <ProfileSummary />
          <WarRecordLinksCard />
          <BoardsCard />
          <AlertSettingsCard />
          <AdminAwardControls />
          <HelpCommunityCard />
          <ProfileBasicsCard />
          <SignOutFooter />
        </div>
      </AuthGate>
    </div>
  )
}
