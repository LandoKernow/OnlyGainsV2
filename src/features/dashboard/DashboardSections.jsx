import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { formatActivityGap, formatActivityValue, formatKm, formatRelativeTime } from '../../utils/activity'
import { getRecentActivityCopy, getChaseCopy } from '../../logic/leaderboard/comments'
import { ACTIVITY_META, ACTIVITY_TYPES, isRepActivity, normalizeActivityType } from '../../utils/activityTypes'
import { getMomentumChip, getRowStatus, getStatusTone } from '../../utils/status'
import { isLeaderMessagePermissionError } from '../../api/leaderMessages'
import { ProfilePreviewModal } from '../../components/ProfilePreviewModal'
import { getWarTier } from '../../utils/war'
import { useEscapeKey } from '../../hooks/useEscapeKey'

const BOARD_LIVE_DIAGNOSTICS_USER_ID = '69e4c6a4-9d17-41bd-a3d3-245205e9c9fb'

function canLogBoardLiveDiagnostics(userId) {
  if (import.meta.env.DEV) {
    return true
  }

  return String(userId || '').trim() === BOARD_LIVE_DIAGNOSTICS_USER_ID
}

function getSafeName(name) {
  return name || 'Someone'
}

function getSafeRank(rank) {
  return Number.isFinite(rank) ? `#${rank}` : 'Unranked'
}

function getGapCopy(gap, activityType, direction) {
  const formattedGap = formatActivityGap(gap, activityType)
  return direction === 'ahead'
    ? `${formattedGap} to overtake`
    : `${formattedGap} behind`
}

function formatSubmissionTimestamp(value) {
  return formatRelativeTime(value)
}

// Heavy logs earn a heat flag in the feed so the big hits stand out.
// Per-activity thresholds: [skull, fire].
const FEED_INTENSITY_THRESHOLDS = {
  pressups: { skull: 200, fire: 100 },
  pullups: { skull: 50, fire: 25 },
  km: { skull: 15, fire: 8 },
  squats: { skull: 500, fire: 250 },
}

function getFeedIntensity(value, activityType) {
  const amount = Number(value) || 0
  const thresholds = FEED_INTENSITY_THRESHOLDS[activityType] ?? FEED_INTENSITY_THRESHOLDS.pressups

  if (amount >= thresholds.skull) return '☠️'
  if (amount >= thresholds.fire) return '🔥'
  return ''
}

function buildStatusChip(label) {
  return {
    label,
    tone: getStatusTone(label),
  }
}

function getLeaderMessageErrorCopy(error) {
  if (isLeaderMessagePermissionError(error)) {
    return 'Only the current weekly leader can take the mic.'
  }

  return "Couldn't save the leader message."
}

function buildLeaderboardChips(row, allRows = [], activityType = 'pressups') {
  const chips = []

  const momentum = getMomentumChip(row, allRows, activityType)
  if (momentum) {
    chips.push(buildStatusChip(momentum))
  }

  // Today's activity
  if (row.todayTotal > 0) {
    chips.push({
      label: `Today: ${activityType === 'km' ? formatKm(row.todayTotal) : row.todayTotal}`,
      tone: 'default',
    })
  }

  // Current user indicator
  if (row.isCurrentUser) {
    chips.push({ label: 'You', tone: 'current' })
  }

  // Pending indicator
  if (row.pending) {
    chips.push({ label: 'Pending', tone: 'warning' })
  }

  return chips
}

function getStatusLine(row, chase, activityType) {
  if (!row) {
    return 'Log to be seen.'
  }

  if (chase?.rowAbove && chase?.gapToCatch != null) {
    return `${formatActivityGap(chase.gapToCatch, activityType)} behind ${getSafeName(chase.rowAbove.actorName)}`
  }

  if (chase?.rowBelow && chase?.gapToDefend != null) {
    return `${formatActivityGap(chase.gapToDefend, activityType)} on ${getSafeName(chase.rowBelow.actorName)}`
  }

  return row.rank === 1 ? 'Nobody is above you.' : 'One log changes the table.'
}

function getLeaderboardBody(period, activityType) {
  if (period === 'weekly' && activityType === 'pressups') {
    return "This week's killers."
  }

  if (period === 'weekly' && activityType === 'pullups') {
    return 'Kings of the bar.'
  }

  if (period === 'weekly' && activityType === 'km') {
    return 'Current war.'
  }

  if (period === 'weekly' && activityType === 'squats') {
    return 'Legs of war.'
  }

  return "The table doesn't care."
}

function getPressureContext(row, allRows = [], activityType = 'pressups') {
  if (row.rank === 1) {
    return 'CROWN'
  }

  const rankAbove = allRows.find((r) => r.rank === row.rank - 1)
  const rankBelow = allRows.find((r) => r.rank === row.rank + 1)

  if (rankAbove && rankBelow) {
    const gapAhead = (rankAbove.total || 0) - (row.total || 0)
    const gapBehind = (row.total || 0) - (rankBelow.total || 0)
    return gapAhead <= gapBehind
      ? `${formatActivityGap(gapAhead, activityType)} from #${row.rank - 1}`
      : `${formatActivityGap(gapBehind, activityType)} ahead of #${row.rank + 1}`
  }

  if (rankAbove) {
    const gapAhead = (rankAbove.total || 0) - (row.total || 0)
    return `${formatActivityGap(gapAhead, activityType)} from #${row.rank - 1}`
  }

  if (rankBelow) {
    const gapBehind = (row.total || 0) - (rankBelow.total || 0)
    return `${formatActivityGap(gapBehind, activityType)} ahead of #${row.rank + 1}`
  }

  return null
}

function LeaderboardRowPreviewModal({ row, activityType, allRows = [], onClose }) {
  if (!row) {
    return null
  }

  return (
    <ProfilePreviewModal
      userId={row.userId}
      initialName={row.actorName || 'Board member'}
      initialRank={row.rank}
      initialWeeklyTotal={row.total}
      initialActivityType={activityType}
      onClose={onClose}
    />
  )
}

function getFightActionCopy({ state, gapToCatch, gapToDefend, activityType }) {
  if (state === 'crown') {
    if (activityType === 'km') {
      return 'Make them chase distance.'
    }

    return activityType === 'pullups' ? 'Make them earn the bar.' : 'Make them bleed reps.'
  }

  if (state === 'hunted') {
    return 'Defend the spot.'
  }

  if (activityType === 'km') {
    if (gapToCatch != null && gapToCatch <= 5) {
      return 'One more run breaks them.'
    }

    return 'Distance breaks the line.'
  }

  if (activityType === 'pullups') {
    if (gapToCatch != null && gapToCatch <= 10) {
      return 'One more set breaks them.'
    }

    if (gapToCatch != null && gapToCatch <= 20) {
      return 'Twenty takes the spot.'
    }

    return 'Add pressure. Move the board.'
  }

  if (activityType === 'squats') {
    if (gapToCatch != null && gapToCatch <= 50) {
      return 'One more drop breaks them.'
    }

    return 'Legs decide this. Keep dropping.'
  }

  if (gapToCatch != null && gapToCatch <= 25) {
    return 'One more set breaks them.'
  }

  if (gapToCatch != null && gapToCatch <= 50) {
    return 'Fifty takes the spot.'
  }

  return 'Add pressure. Move the board.'
}

function getFightHero(currentUserRow, chase, activityType) {
  if (!currentUserRow) {
    return {
      eyebrow: 'THE BOARD REMEMBERS',
      title: 'Log first. Make yourself visible.',
      body: 'No rank yet. No pressure yet.',
      action: 'The next log puts your name on it.',
    }
  }

  if (currentUserRow.rank === 1) {
    const rivalName = getSafeName(chase?.rowBelow?.actorName)
    const gapBehind = chase?.gapToDefend != null ? formatActivityGap(chase.gapToDefend, activityType) : null

    return {
      eyebrow: 'YOU HOLD THE CROWN',
      title: gapBehind ? `${rivalName} is ${gapBehind} behind.` : 'No one above. No one close.',
      body: gapBehind ? getFightActionCopy({ state: 'crown', gapToDefend: chase?.gapToDefend, activityType }) : 'Hold the line.',
      action: currentUserRow ? `${formatActivityValue(currentUserRow.total, activityType)} this week` : '',
    }
  }

  if (
    chase?.rowBelow &&
    chase?.gapToDefend != null &&
    (chase?.gapToCatch == null || chase.gapToDefend < chase.gapToCatch)
  ) {
    return {
      eyebrow: 'YOU ARE BEING HUNTED',
      title: `${getSafeName(chase.rowBelow.actorName)} is ${formatActivityGap(chase.gapToDefend, activityType)} behind.`,
      body: getFightActionCopy({ state: 'hunted', gapToDefend: chase.gapToDefend, activityType }),
      action: `#${currentUserRow.rank} this week`,
    }
  }

  if (chase?.rowAbove && chase?.gapToCatch != null) {
    return {
      eyebrow: `#${currentUserRow.rank} THIS WEEK`,
      title: `${formatActivityGap(chase.gapToCatch, activityType)} from ${getSafeName(chase.rowAbove.actorName).toUpperCase()}.`,
      body: getFightActionCopy({ state: 'chasing', gapToCatch: chase.gapToCatch, activityType }),
      action: `${formatActivityValue(currentUserRow.total, activityType)} on the board`,
    }
  }

  return {
    eyebrow: `#${currentUserRow.rank} THIS WEEK`,
    title: `${formatActivityValue(currentUserRow.total, activityType)} visible.`,
    body: 'Stay active. Keep pressure on the board.',
    action: 'One more log changes the table.',
  }
}

export function HeroStatus({ profile, currentUserRow, chase, rows = [], activityType = 'pressups', streak = null, level = null, combo = 0 }) {
  const statusLabel = currentUserRow ? getRowStatus(currentUserRow, rows, activityType) : 'QUIET'
  const hero = getFightHero(currentUserRow, chase, activityType)
  const tier = getWarTier(currentUserRow?.total ?? 0, activityType)
  const streakDays = streak?.streakDays ?? 0
  const chips = currentUserRow
    ? [
        buildStatusChip(statusLabel),
        currentUserRow.todayTotal > 0
          ? {
              label: activityType === 'km' ? `${formatKm(currentUserRow.todayTotal)} today` : `${currentUserRow.todayTotal} today`,
              tone: 'default',
            }
          : null,
      ].filter(Boolean)
    : [buildStatusChip('QUIET')]

  return (
    <Card title={hero.eyebrow} body={hero.title}>
      <div className="stack hero-fight-card">
        <div className="hero-war-banner">
          <div className="hero-war-banner__tier">
            <span className="hero-war-banner__tier-label">RANK</span>
            <strong className="hero-war-banner__tier-name">{level?.name ? `LVL ${level.level} ${level.name}` : tier}</strong>
          </div>
          <div className={streak?.atRisk ? 'hero-war-banner__streak hero-war-banner__streak--risk' : 'hero-war-banner__streak'}>
            <strong className="hero-war-banner__streak-value">
              {streakDays > 0 ? `${streakDays}🔥` : '0'}
              {combo >= 2 ? <span className="hero-combo"> ×{combo}</span> : null}
            </strong>
            <span className="hero-war-banner__streak-label">
              {streak?.atRisk ? 'STREAK DIES AT MIDNIGHT' : streakDays > 0 ? 'DAY STREAK' : 'NO STREAK. START ONE.'}
              {combo >= 2 ? ' · HEAVY COMBO' : ''}
            </span>
          </div>
        </div>
        {level?.name && !level.isLoading ? (
          <div className="hero-level">
            <div className="hero-level__row">
              <strong className="hero-level__name">SEASON XP</strong>
              <span className="hero-level__xp">
                {level.nextLevelName
                  ? `${level.xpToNextLevel.toLocaleString('en-GB')} XP TO ${level.nextLevelName}`
                  : 'MAX RANK. HOLD IT.'}
              </span>
            </div>
            <div className="hero-level__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
              <div className="hero-level__fill" style={{ width: `${Math.max(level.progress * 100, 2)}%` }} />
            </div>
          </div>
        ) : null}
        <div className="hero-status-grid">
          <div className="hero-status-grid__main">
            <strong>{hero.body}</strong>
            <span>{hero.action}</span>
          </div>
          <div className="hero-status-grid__meta">
            <span>{profile?.name || 'Warrior'}</span>
            <span>{getStatusLine(currentUserRow, chase, activityType)}</span>
          </div>
        </div>
        <div className="row-chip-list">
          {chips.map((chip) => (
            <span key={chip.label} className={chip.tone ? `row-chip row-chip--${chip.tone}` : 'row-chip'}>
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}

export function ProfileReadinessCard({ profile, isLoading, error }) {
  if (isLoading) {
    return (
      <Card title="Loading" body="Getting your profile ready.">
        <p className="muted">One moment.</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="Profile error" body="Could not load your profile.">
        <p className="muted">Try again.</p>
      </Card>
    )
  }

  return null
}

export function LogActivityCard({
  quickValues,
  manualValue,
  manualError,
  onManualValueChange,
  onQuickLog,
  onManualSubmit,
  isSaving,
  activityType = 'pressups',
  onActivityTypeChange,
}) {
  const isKm = activityType === 'km'
  const meta = ACTIVITY_META[normalizeActivityType(activityType)]

  return (
    <Card title="LOG THE HIT" body="Move the board. Make it public.">
      <div className="dashboard-activity-toggle">
        {ACTIVITY_TYPES.map((type) => (
          <button
            key={type}
            className={activityType === type ? 'pill-button pill-button--active' : 'pill-button'}
            type="button"
            onClick={() => onActivityTypeChange?.(type)}
          >
            {ACTIVITY_META[type].label}
          </button>
        ))}
      </div>
      {isRepActivity(activityType) && quickValues.length > 0 ? (
        <div className="quick-actions quick-actions--board">
          {quickValues.map((quickValue) => (
            <button
              key={quickValue}
              className="chip"
              type="button"
              disabled={isSaving}
              onClick={() => onQuickLog(quickValue)}
            >
              +{quickValue}
            </button>
          ))}
        </div>
      ) : null}
      <form className="stack section-gap" onSubmit={onManualSubmit}>
        <label className="stack">
          <span>{meta.inputLabel}</span>
          <input
            className="input"
            type="number"
            min={isKm ? '0.01' : '1'}
            step={isKm ? '0.01' : '1'}
            inputMode="decimal"
            value={manualValue}
            onChange={(event) => onManualValueChange(event.target.value)}
            placeholder={meta.inputPlaceholder}
            disabled={isSaving}
          />
        </label>
        <button className="button" type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Log'}
        </button>
      </form>
      {manualError ? <p className="muted">{manualError}</p> : null}
    </Card>
  )
}

export function LeaderboardPlaceholder() {
  return (
    <Card title="Leaderboard" body="Weekly, monthly, and yearly board views will mount here without re-rendering the full shell.">
      <div className="placeholder-tabs">
        <span className="pill pill--active">Press Ups</span>
        <span className="pill">KM</span>
        <span className="pill pill--active">Weekly</span>
        <span className="pill">Monthly</span>
        <span className="pill">Yearly</span>
      </div>
      <p className="muted">Leaderboard totals will appear once the board warms up.</p>
    </Card>
  )
}

export function WeeklyLeaderMessageCard({
  messageRow,
  leaderName,
  isLeader,
  isLoading,
  saveMessage,
}) {
  const [draftMessage, setDraftMessage] = useState('')
  const [validationError, setValidationError] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (messageRow?.message) {
      setDraftMessage(messageRow.message)
    }
  }, [messageRow?.message])

  useEffect(() => {
    if (!isLeader) {
      setIsExpanded(false)
    }
  }, [isLeader])

  const hasMessage = Boolean(messageRow?.message)
  const isSaving = saveMessage?.isPending

  function handleSubmit(event) {
    event.preventDefault()

    const normalized = draftMessage.trim()

    if (!normalized) {
      setValidationError('Say something first.')
      return
    }

    if (normalized.length > 120) {
      setValidationError('Keep it under 120 characters.')
      return
    }

    setValidationError('')
    saveMessage.mutate({ message: normalized })
  }

  return (
    <Card title="LEADER MESSAGE" body={hasMessage ? `${leaderName}: "${messageRow.message}"` : 'The leader has not spoken.'}>
      {isLoading ? (
        <p className="muted">Checking the weekly leader message.</p>
      ) : (
        <div className="stack board-leader-message">
          {isLeader && !isExpanded ? (
            <div className="board-leader-message__actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
              >
                {hasMessage ? 'Edit' : 'Take the mic'}
              </button>
            </div>
          ) : null}

          {isLeader && isExpanded ? (
            <form className="stack section-gap" onSubmit={handleSubmit}>
              <label className="stack">
                <span>Message</span>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={120}
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="Say something sharp. 120 characters max."
                  disabled={isSaving}
                />
              </label>
              <div className="profile-summary-actions">
                <button className="button" type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="button button--ghost"
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setDraftMessage(messageRow?.message ?? '')
                    setValidationError('')
                    setIsExpanded(false)
                  }}
                >
                  Cancel
                </button>
              </div>
              <div className="stack">
                {validationError ? <p className="muted">{validationError}</p> : null}
                {saveMessage?.error ? (
                  <p className="muted">{getLeaderMessageErrorCopy(saveMessage.error)}</p>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>
      )}
    </Card>
  )
}

export function PressupLeaderboardCard({ period, onPeriodChange, rows, currentUserRow, isLoading, error, compact = false, activityType = 'pressups' }) {
  const [previewRow, setPreviewRow] = useState(null)
  const periods = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ]

  const isKm = activityType === 'km'
  const cardBody = getLeaderboardBody(period, activityType)

  function formatValue(value) {
    return formatActivityValue(value, activityType)
  }

  function handlePreviewRow(row) {
    if (row.pending) {
      return
    }
    setPreviewRow(row)
  }

  function handleRowKeyDown(event, row) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handlePreviewRow(row)
    }
  }

  const compactRows = useMemo(() => {
    if (!compact) {
      return rows
    }

    const topThree = rows.slice(0, 3)

    if (!currentUserRow || topThree.some((row) => row.userId === currentUserRow.userId)) {
      return topThree
    }

    return [...topThree, currentUserRow]
  }, [compact, currentUserRow, rows])

  return (
    <Card title={compact ? 'MINI RANKS' : 'Ranks'} body={compact ? 'Top 3 plus your spot.' : cardBody}>
      {!compact ? (
        <div className="placeholder-tabs">
          {/* Activity tabs live on the screen-level toggle (LeaderboardScreen);
              this header only owns the period buttons — no duplicate set. */}
          {periods.map((item) => (
            <button
              key={item.key}
              className={item.key === period ? 'pill-button pill-button--active' : 'pill-button'}
              type="button"
              onClick={() => onPeriodChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {currentUserRow && !compact ? (
        <div className="leaderboard-summary">
          <strong>Your rank: #{currentUserRow.rank}</strong>
          <span>{formatValue(currentUserRow.total)}</span>
          <span>{isKm ? `${formatKm(currentUserRow.todayTotal)} today` : `${currentUserRow.todayTotal} today`}</span>
        </div>
      ) : !compact ? (
        <div className="stack">
          <strong>{compact ? 'No rank yet.' : 'Not on the board yet.'}</strong>
          <p className="muted">Log first. Make them chase.</p>
        </div>
      ) : null}
      {error && rows.length === 0 ? <p className="muted">Board failed to load. Refresh.</p> : null}
      {isLoading ? <p className="muted">Loading...</p> : null}
      {!isLoading && compact && rows.length === 0 ? <p className="muted">Log first. Make yourself visible.</p> : null}
      {(compact ? compactRows : rows).length > 0 ? (
        <>
          <ol className={compact ? 'leaderboard-list leaderboard-list--board' : 'leaderboard-list'}>
            {(compact ? compactRows : rows).map((row) => {
              const status = getRowStatus(row, rows, activityType)
              const pressureContext = getPressureContext(row, rows, activityType)
              const rowClassName = [
                'leaderboard-row',
                row.isCurrentUser ? 'leaderboard-row--current' : '',
                row.rank === 1 ? 'leaderboard-row--crown' : '',
                status === 'QUIET' || status === 'COLD' ? 'leaderboard-row--quiet' : '',
                'leaderboard-row--clickable',
              ].filter(Boolean).join(' ')

              return (
                <li
                  key={row.userId}
                  className={rowClassName}
                  onClick={() => handlePreviewRow(row)}
                  onKeyDown={(event) => handleRowKeyDown(event, row)}
                  role="button"
                  tabIndex={row.pending ? -1 : 0}
                  aria-label={`Preview ${row.actorName}`}
                >
                  <div className="leaderboard-rank">#{row.rank}</div>
                  <div className="leaderboard-copy">
                    <strong>
                      {row.actorName}
                      <span className="leaderboard-tier">FORM · {getWarTier(row.total, activityType)}</span>
                    </strong>
                    {pressureContext ? <span className="pressure-gap">{pressureContext}</span> : null}
                    <div className="row-chip-list">
                      {buildLeaderboardChips(row, rows, activityType).map((chip) => (
                        <span
                          key={`${row.userId}-${chip.label}`}
                          className={chip.tone ? `row-chip row-chip--${chip.tone}` : 'row-chip'}
                        >
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="leaderboard-total">{formatValue(row.total)}</div>
                </li>
              )
            })}
          </ol>
          {compact ? (
            <div className="section-gap">
              <Link className="button button--ghost dashboard-link-button" to="/leaderboard">
                View full ranks
              </Link>
            </div>
          ) : null}
          <LeaderboardRowPreviewModal
            row={previewRow}
            activityType={activityType}
            allRows={rows}
            onClose={() => setPreviewRow(null)}
          />
        </>
      ) : null}
    </Card>
  )
}

export function HallOfShameCard({ rows = [], activityType = 'pressups' }) {
  // The basement of the board. Only meaningful once there's a real field to
  // fall to the bottom of — derived from the same ranked rows, no extra fetch.
  const ranked = rows.filter((row) => !row.pending)

  if (ranked.length < 5) {
    return null
  }

  const shame = ranked.slice(-3).reverse()

  return (
    <Card title="HALL OF SHAME" body="The basement of the board. Climb out or stay buried.">
      <ol className="shame-list">
        {shame.map((row) => (
          <li key={row.userId} className={row.isCurrentUser ? 'shame-row shame-row--current' : 'shame-row'}>
            <div className="shame-row__rank">#{row.rank}</div>
            <div className="shame-row__copy">
              <strong>
                {row.actorName}
                <span className="leaderboard-tier leaderboard-tier--shame">FORM · {getWarTier(row.total, activityType)}</span>
              </strong>
              <span className="shame-row__meta">
                {row.todayTotal > 0 ? 'Scraping by today.' : 'Silent today. The board noticed.'}
              </span>
            </div>
            <div className="shame-row__total">{formatActivityValue(row.total, activityType)}</div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function BattleReplayCard({ chase, isLoading, activityType = 'pressups' }) {
  if (isLoading) {
    return (
      <Card title="BATTLE REPLAY" body="Loading the matchup.">
        <p className="muted">Sizing up the field...</p>
      </Card>
    )
  }

  const you = chase?.currentUserRow
  const target = chase?.rowAbove ?? null
  const hunter = chase?.rowBelow ?? null
  const opponent = target ?? hunter

  if (!you) {
    return (
      <Card title="BATTLE REPLAY" body="No matchup yet.">
        <p className="muted">Log first. The arena pairs you with someone to break.</p>
      </Card>
    )
  }

  if (!opponent) {
    return (
      <Card title="BATTLE REPLAY" body="You stand alone.">
        <p className="muted">Nobody above. Nobody close. Widen the gap and make them chase.</p>
      </Card>
    )
  }

  const isChasing = Boolean(target)
  const gapValue = isChasing ? chase?.gapToCatch : chase?.gapToDefend
  const gapLabel = gapValue != null ? formatActivityGap(gapValue, activityType) : ''

  function side(row, role) {
    return (
      <div className={role === 'you' ? 'replay-side replay-side--you' : 'replay-side'}>
        <span className="replay-side__role">{role === 'you' ? 'YOU' : isChasing ? 'TARGET' : 'HUNTER'}</span>
        <strong className="replay-side__name">{getSafeName(row.actorName)}</strong>
        <span className="replay-side__tier">FORM · {getWarTier(row.total, activityType)}</span>
        <div className="replay-side__stats">
          <span className="replay-side__rank">{getSafeRank(row.rank)}</span>
          <strong className="replay-side__total">{formatActivityValue(row.total, activityType)}</strong>
          <span className="replay-side__today">
            {row.todayTotal > 0 ? `${formatActivityValue(row.todayTotal, activityType)} today` : 'Quiet today'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card
      title="BATTLE REPLAY"
      body={isChasing ? `${gapLabel} from taking the spot.` : `${gapLabel} on the warrior below you.`}
    >
      <div className="battle-replay">
        {side(you, 'you')}
        <div className="replay-versus">
          <span className="replay-versus__vs">VS</span>
          {gapLabel ? <span className="replay-versus__gap">{gapLabel}</span> : null}
          <span className="replay-versus__cry">{isChasing ? 'ONE LOG CLOSES THIS.' : 'WIDEN IT.'}</span>
        </div>
        {side(opponent, 'opponent')}
      </div>
    </Card>
  )
}

export function ChaseCard({ chase, isLoading, period, compact = false, activityType = 'pressups' }) {
  const isKm = activityType === 'km'

  if (isLoading) {
    return (
      <Card title="Chase" body="Computing pressure.">
        <p className="muted">One moment...</p>
      </Card>
    )
  }

  const copy = getChaseCopy(chase, activityType)

  return (
    <Card title={copy.title} body={copy.primary}>
      <div className={compact ? 'stack chase-stack chase-stack--compact' : 'stack chase-stack'}>
        <strong>{copy.primary}</strong>
        {copy.secondary ? <span>{copy.secondary}</span> : null}
        {copy.action ? <span>{copy.action}</span> : null}
      </div>
    </Card>
  )
}

export function PressureCard({ chase, isLoading, activityType = 'pressups', variant = 'board' }) {
  if (isLoading) {
    return (
      <Card title={variant === 'chase' ? 'CHASE' : 'PRESSURE'} body="Sizing the gap.">
        <p className="muted">One moment...</p>
      </Card>
    )
  }

  if (!chase?.currentUserRow) {
    return (
      <Card title={variant === 'chase' ? 'CHASE' : 'PRESSURE'} body="Log effort to enter the fight.">
        <p className="muted">Log effort to enter the fight.</p>
      </Card>
    )
  }

  const rowAbove = chase.rowAbove
  const rowBelow = chase.rowBelow
  const chasingCopy = rowAbove
    ? {
        name: getSafeName(rowAbove.actorName),
        rank: getSafeRank(rowAbove.rank),
        gap: getGapCopy(chase.gapToCatch ?? 0, activityType, 'ahead'),
      }
    : null
  const huntedCopy = rowBelow
    ? {
        name: getSafeName(rowBelow.actorName),
        rank: getSafeRank(rowBelow.rank),
        gap: getGapCopy(chase.gapToDefend ?? 0, activityType, 'behind'),
      }
    : null

  return (
    <Card
      title={variant === 'chase' ? 'CHASE' : 'PRESSURE'}
      body={variant === 'chase' ? 'Target above. Threat below.' : 'Who you are chasing. Who is chasing you.'}
    >
      <div className={variant === 'chase' ? 'pressure-split-grid pressure-split-grid--chase' : 'pressure-split-grid'}>
        <div className={variant === 'chase' ? 'pressure-row pressure-row--chase' : 'pressure-row'}>
          <strong>{variant === 'chase' ? 'TARGET' : "YOU'RE CHASING"}</strong>
          {chasingCopy ? (
            <>
              <span className="pressure-row__meta">
                {chasingCopy.name} <span aria-hidden="true">&middot;</span> {chasingCopy.rank}
              </span>
              <span>{variant === 'chase' ? `${chasingCopy.gap} to take the spot` : chasingCopy.gap}</span>
            </>
          ) : (
            <>
              <span className="pressure-row__meta">No one above you.</span>
              <span>Hold the crown.</span>
            </>
          )}
        </div>
        <div className={variant === 'chase' ? 'pressure-row pressure-row--chase' : 'pressure-row'}>
          <strong>{variant === 'chase' ? 'DEFEND' : 'CHASING YOU'}</strong>
          {huntedCopy ? (
            <>
              <span className="pressure-row__meta">
                {huntedCopy.name} <span aria-hidden="true">&middot;</span> {huntedCopy.rank}
              </span>
              <span>{variant === 'chase' ? `${huntedCopy.gap} behind` : huntedCopy.gap}</span>
            </>
          ) : (
            <>
              <span className="pressure-row__meta">No one close.</span>
              <span>Widen the gap.</span>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

export function ChasePlaceholder() {
  return (
    <Card title="The Chase" body="Ahead and behind rival logic will use precomputed board ranks instead of row-level recalculation.">
      <p className="muted">You&apos;re hunting somebody. Somebody is hunting you.</p>
    </Card>
  )
}

export function RecentActivityCard({ rows, isLoading, error, currentUserId, onRequestRemove }) {
  const [showAll, setShowAll] = useState(false)

  const { visibleRows, latestCurrentUserRowInjected } = useMemo(() => {
    if (showAll) {
      return { visibleRows: rows, latestCurrentUserRowInjected: false }
    }

    const topRows = rows.slice(0, 3)

    if (!currentUserId || topRows.some((row) => row.userId === currentUserId)) {
      return { visibleRows: topRows, latestCurrentUserRowInjected: false }
    }

    const latestCurrentUserRow = rows.find((row) => row.userId === currentUserId)

    if (!latestCurrentUserRow) {
      return { visibleRows: topRows, latestCurrentUserRowInjected: false }
    }

    return { visibleRows: [...topRows, latestCurrentUserRow], latestCurrentUserRowInjected: true }
  }, [currentUserId, rows, showAll])

  if (error && rows.length === 0) {
    return (
      <Card title="BOARD LIVE" body="Could not load recent activity.">
        <p className="muted">Try again.</p>
      </Card>
    )
  }

  if (canLogBoardLiveDiagnostics(currentUserId)) {
    console.debug('[Only Gains Board Live]', 'RecentActivityCard render', {
      isLoading,
      hasError: Boolean(error),
      totalRowCount: rows.length,
      totalRowIds: rows.map((row) => row.id),
      totalLegacySubmissionIds: rows.map((row) => row.legacySubmissionId || null),
      renderedRowCount: visibleRows.length,
      renderedRowIds: visibleRows.map((row) => row.id),
      showAll,
      latestCurrentUserRowInjected,
      currentUserId: currentUserId ?? null,
    })
  }

  return (
    <Card title="BOARD LIVE" body={`${rows.length} recent moves`} aside={<span className="live-badge">LIVE</span>}>
      {error && rows.length > 0 ? <p className="muted">Could not refresh. Try again.</p> : null}
      {isLoading ? <p className="muted">Loading...</p> : null}
      {!isLoading && rows.length === 0 ? (
        <div className="stack">
          <strong>No movement yet.</strong>
          <p className="muted">You go first.</p>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="activity-feed">
          {visibleRows.map((row, index) => {
            const canRemove = row.userId === currentUserId && !row.pending && Boolean(row.legacySubmissionId)

            return (
              <li
                key={row.id}
                className={[
                  'activity-item',
                  'activity-item--compact',
                  row.pending ? 'activity-item--pending' : '',
                  index === 0 ? 'activity-item--latest' : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="activity-copy">
                  <strong>{getRecentActivityCopy(row, currentUserId)}</strong>
                  <span>{row.pending ? 'Saving...' : formatSubmissionTimestamp(row.createdAt)}</span>
                </div>
                <div className="activity-meta">
                  <span className="activity-value">
                    {getFeedIntensity(row.value, row.activityType)
                      ? <span className="activity-intensity" aria-hidden="true">{getFeedIntensity(row.value, row.activityType)} </span>
                      : null}
                    {formatActivityValue(row.value, row.activityType)}
                  </span>
                  {canRemove ? (
                    <button className="activity-remove" type="button" onClick={() => onRequestRemove(row)}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
      {rows.length > 3 ? (
        <div className="section-gap">
          <button className="button button--ghost dashboard-link-button" type="button" onClick={() => setShowAll((current) => !current)}>
            {showAll ? 'Show less' : 'View more'}
          </button>
        </div>
      ) : null}
    </Card>
  )
}

export function RemoveEntryModal({ submission, onConfirm, onCancel, isDeleting }) {
  useEscapeKey(onCancel, Boolean(submission) && !isDeleting)

  if (!submission) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-entry-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="stack">
          <div>
            <h2 id="remove-entry-title" className="modal-title">Remove entry</h2>
            <p className="muted">This removes the exact saved entry from every board it touched.</p>
          </div>
          <div className="modal-summary">
            <span>{formatActivityValue(submission.value, submission.activityType)}</span>
            <span>{formatSubmissionTimestamp(submission.createdAt)}</span>
          </div>
          <div className="modal-actions">
            <button className="button button--ghost" type="button" onClick={onCancel} disabled={isDeleting}>
              Keep it
            </button>
            <button className="button" type="button" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? 'Removing...' : 'Remove entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
