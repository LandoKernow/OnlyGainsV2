import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { formatActivityValue, formatKm, formatRelativeTime } from '../../utils/activity'
import { getLeaderboardComment, getRecentActivityCopy, getChaseCopy } from '../../logic/leaderboard/comments'
import { getMomentumChip, getPressureGap } from '../../utils/status'

function formatSubmissionTimestamp(value) {
  return formatRelativeTime(value)
}

function buildLeaderboardChips(row, allRows = []) {
  const chips = []

  // Momentum indicator
  const momentum = getMomentumChip(row)
  if (momentum) {
    chips.push(momentum)
  }

  // Today's activity
  if (row.todayTotal > 0) {
    chips.push(`Today: ${row.todayTotal}`)
  }

  // Current user indicator
  if (row.isCurrentUser) {
    chips.push('You')
  }

  // Pending indicator
  if (row.pending) {
    chips.push('Pending')
  }

  return chips
}

function getPressureContext(row, allRows = []) {
  if (row.rank === 1) {
    return 'CROWN'
  }

  const rankAbove = allRows.find((r) => r.rank === row.rank - 1)
  const rankBelow = allRows.find((r) => r.rank === row.rank + 1)

  if (rankAbove && rankBelow) {
    const gapAhead = (rankAbove.total || 0) - (row.total || 0)
    const gapBehind = (row.total || 0) - (rankBelow.total || 0)
    return gapAhead <= gapBehind ? `${gapAhead} from #${row.rank - 1}` : `${gapBehind} ahead of #${row.rank + 1}`
  }

  if (rankAbove) {
    const gapAhead = (rankAbove.total || 0) - (row.total || 0)
    return `${gapAhead} from #${row.rank - 1}`
  }

  if (rankBelow) {
    const gapBehind = (row.total || 0) - (rankBelow.total || 0)
    return `${gapBehind} ahead of #${row.rank + 1}`
  }

  return null
}

export function HeroStatus({ profile }) {
  const statusLabel = profile?.board_status ? String(profile.board_status) : 'active'

  return (
    <Card title={`${profile?.name || 'Warrior'}`} body="Visible discipline.">
      <div className="stack">
        <div className="stat-strip">
          <span>Status: {statusLabel}</span>
          <span>Show up. Log it. Get better.</span>
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
}) {
  const isKm = activityType === 'km'

  return (
    <Card title={isKm ? 'Log KM' : 'Log Press-Ups'} body={isKm ? 'Distance logged.' : 'Board moves with every rep.'}>
      {!isKm ? (
        <div className="quick-actions">
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
          <span>{isKm ? 'KM' : 'Reps'}</span>
          <input
            className="input"
            type="number"
            min={isKm ? '0.01' : '1'}
            step={isKm ? '0.01' : '1'}
            inputMode="decimal"
            value={manualValue}
            onChange={(event) => onManualValueChange(event.target.value)}
            placeholder={isKm ? 'e.g. 5.2' : 'e.g. 25'}
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
  isLeader,
  isLoading,
  saveMessage,
}) {
  const [draftMessage, setDraftMessage] = useState('')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (messageRow?.message) {
      setDraftMessage(messageRow.message)
    }
  }, [messageRow?.message])

  const hasMessage = Boolean(messageRow?.message)
  const isSaving = saveMessage?.isLoading

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
    saveMessage.mutate({ message: normalized, existingId: messageRow?.id })
  }

  return (
    <Card title="Leader message" body="Weekly press-up leader attention.">
      {isLoading ? (
        <p className="muted">Checking the weekly leader message.</p>
      ) : (
        <div className="stack">
          {hasMessage ? (
            <blockquote className="leader-message">{messageRow.message}</blockquote>
          ) : (
            <div className="stack">
              <strong>{isLeader ? 'The board is waiting.' : 'No message set yet.'}</strong>
              <span>
                {isLeader
                  ? 'Write the weekly press-up leader message that everyone sees.'
                  : 'The weekly press-up leader can set a short message for the board.'}
              </span>
            </div>
          )}

          {isLeader ? (
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
              <div className="stack">
                <button className="button" type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Set message'}
                </button>
                {validationError ? <p className="muted">{validationError}</p> : null}
                {saveMessage?.error ? (
                  <p className="muted">Unable to save. {saveMessage.error.message}</p>
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
  const periods = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ]

  const isKm = activityType === 'km'
  const cardBody = isKm ? 'KM standings.' : 'Who\'s winning.'

  function formatValue(value) {
    return formatActivityValue(value, activityType)
  }

  return (
    <Card title="Ranks" body={cardBody}>
      <div className="placeholder-tabs">
        <span className={isKm ? 'pill' : 'pill pill--active'}>Press Ups</span>
        <span className={isKm ? 'pill pill--active' : 'pill'}>KM</span>
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
      {currentUserRow ? (
        <div className="leaderboard-summary">
          <strong>Your rank: #{currentUserRow.rank}</strong>
          <span>{formatValue(currentUserRow.total)}</span>
          <span>{isKm ? `${formatKm(currentUserRow.todayTotal)} today` : `${currentUserRow.todayTotal} today`}</span>
        </div>
      ) : (
        <div className="stack">
          <strong>Not on the board yet.</strong>
          <p className="muted">Log first. Make them chase.</p>
        </div>
      )}
      {error && rows.length === 0 ? <p className="muted">Board failed to load. Refresh.</p> : null}
      {isLoading ? <p className="muted">Loading...</p> : null}
      {rows.length > 0 ? (
        <ol className={compact ? 'leaderboard-list leaderboard-list--compact' : 'leaderboard-list'}>
          {rows.map((row) => {
            const pressureContext = getPressureContext(row, rows)
            return (
              <li
                key={row.userId}
                className={row.isCurrentUser ? 'leaderboard-row leaderboard-row--current' : 'leaderboard-row'}
              >
                <div className="leaderboard-rank">#{row.rank}</div>
                <div className="leaderboard-copy">
                  <strong>{row.actorName}</strong>
                  {pressureContext ? <span className="pressure-gap">{pressureContext}</span> : null}
                  <div className="row-chip-list">
                    {buildLeaderboardChips(row, rows).map((chip) => (
                      <span key={`${row.userId}-${chip}`} className="row-chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="leaderboard-total">{formatValue(row.total)}</div>
              </li>
            )
          })}
        </ol>
      ) : null}
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

  const copy = getChaseCopy(chase)

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

export function ChasePlaceholder() {
  return (
    <Card title="The Chase" body="Ahead and behind rival logic will use precomputed board ranks instead of row-level recalculation.">
      <p className="muted">You&apos;re hunting somebody. Somebody is hunting you.</p>
    </Card>
  )
}

export function RecentActivityCard({ rows, isLoading, error, currentUserId, onRequestRemove }) {
  if (error && rows.length === 0) {
    return (
      <Card title="Board live" body="Could not load recent activity.">
        <p className="muted">Try again.</p>
      </Card>
    )
  }

  return (
    <Card title="Board live" body="Is the board moving?">
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
          {rows.map((row) => {
            const canRemove = row.userId === currentUserId && !row.pending

            return (
              <li key={row.id} className={row.pending ? 'activity-item activity-item--pending' : 'activity-item'}>
                <div className="activity-copy">
                  <strong>{getRecentActivityCopy(row, currentUserId)}</strong>
                  <span>{row.pending ? 'Saving...' : formatSubmissionTimestamp(row.createdAt)}</span>
                </div>
                <div className="activity-meta">
                  <span className="activity-value">{formatActivityValue(row.value, row.activityType)}</span>
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
    </Card>
  )
}

export function RemoveEntryModal({ submission, onConfirm, onCancel, isDeleting }) {
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
            <p className="muted">This removes the exact saved press-up entry from the board.</p>
          </div>
          <div className="modal-summary">
            <span>{submission.value} press-ups</span>
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
