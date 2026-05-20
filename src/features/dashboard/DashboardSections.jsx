import { Card } from '../../components/Card'
import { formatActivityValue, formatKm, formatRelativeTime } from '../../utils/activity'
import { getLeaderboardComment, getRecentActivityCopy, getChaseCopy } from '../../logic/leaderboard/comments'

function formatSubmissionTimestamp(value) {
  return formatRelativeTime(value)
}

function buildLeaderboardChips(row) {
  const chips = [`#${row.rank}`, `Today: ${row.todayTotal}`]

  if (row.isCurrentUser) {
    chips.push('You')
  }

  if (row.pending) {
    chips.push('Pending')
  }

  return chips
}

export function HeroStatus({ profile }) {
  const statusLabel = profile?.board_status ? String(profile.board_status) : 'active'

  return (
    <Card title={`${profile?.name || 'Warrior'}`} body="Board live.">
      <div className="stack">
        <div className="stat-strip">
          <span>Status: {statusLabel}</span>
          <span>You’re in the fight.</span>
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

export function PressupLeaderboardCard({ period, onPeriodChange, rows, currentUserRow, isLoading, error, compact = false, activityType = 'pressups' }) {
  const periods = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
  ]

  const isKm = activityType === 'km'

  function formatValue(value) {
    return formatActivityValue(value, activityType)
  }

  return (
    <Card title="Ranks" body={isKm ? 'KM totals.' : 'Press-up totals.'}>
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
          <span>{formatValue(currentUserRow.total)} this {period.replace('ly', '')}</span>
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
          {rows.map((row) => (
            <li
              key={row.userId}
              className={row.isCurrentUser ? 'leaderboard-row leaderboard-row--current' : 'leaderboard-row'}
            >
              <div className="leaderboard-rank">#{row.rank}</div>
              <div className="leaderboard-copy">
                <strong>{row.actorName}</strong>
                {getLeaderboardComment(row) ? <span>{getLeaderboardComment(row)}</span> : null}
                <div className="row-chip-list">
                  {buildLeaderboardChips(row).map((chip) => (
                    <span key={`${row.userId}-${chip}`} className="row-chip">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="leaderboard-total">{formatValue(row.total)}</div>
            </li>
          ))}
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
    <Card title="Board live" body="Recent movement.">
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
