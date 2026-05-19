import { Card } from '../../components/Card'
import { getLeaderboardComment, getRecentActivityCopy } from '../../logic/leaderboard/comments'

function formatSubmissionTimestamp(value) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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
  return (
    <Card
      title={profile?.name ? `${profile.name}, board live` : 'Board ready'}
      body="Fast press-up path only. Keep the board moving."
    >
      <div className="stack">
        <div className="stat-strip">
          <span>{profile?.board_status ?? 'Active'}</span>
          <span>Live board</span>
        </div>
        <p className="muted">Press-ups first. Keep the board moving with every set.</p>
      </div>
    </Card>
  )
}

export function ProfileReadinessCard({ profile, isLoading, error }) {
  if (isLoading) {
    return (
      <Card title="Profile loading" body="Getting your board identity ready.">
        <p className="muted">If you are new here, a minimal profile is being created now.</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="Profile hit a snag" body="Auth worked, but the profile could not load.">
        <p className="muted">Could not load profile. Try again.</p>
      </Card>
    )
  }

  return (
    <Card title="Profile ready" body="Your board profile is set and ready to log press-ups.">
      <div className="stat-strip">
        <span>{profile?.name ?? 'Unnamed warrior'}</span>
        <span>{profile?.board_status ?? 'Active'}</span>
      </div>
    </Card>
  )
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
    <Card title="Log Activity" body={isKm ? 'Log distance quickly and keep the board honest.' : 'Tap reps fast and watch the board move.'}>
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
          <span>{isKm ? 'Manual KM log' : 'Manual press-up log'}</span>
          <input
            className="input"
            type="number"
            min={isKm ? '0.1' : '1'}
            step={isKm ? '0.1' : '1'}
            inputMode="decimal"
            value={manualValue}
            onChange={(event) => onManualValueChange(event.target.value)}
            placeholder={isKm ? 'Enter km' : 'Enter reps'}
            disabled={isSaving}
          />
        </label>
        <button className="button" type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : isKm ? 'Log KM' : 'Log Press-Ups'}
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
    if (isKm) {
      return `${Number(value).toFixed(1)} km`
    }

    return `${Math.round(Number(value) || 0)} reps`
  }

  return (
    <Card title="Leaderboard" body={isKm ? 'KM totals for the current board period.' : 'Press-up totals for the current board period.'}>
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
          <span>{isKm ? `${Number(currentUserRow.todayTotal).toFixed(1)} today` : `${currentUserRow.todayTotal} today`}</span>
        </div>
      ) : (
        <div className="stack">
          <strong>No one has moved yet.</strong>
          <p className="muted">Log first. Make them chase.</p>
        </div>
      )}
      {error && rows.length === 0 ? <p className="muted">Board failed to load. Refresh and go again.</p> : null}
      {isLoading ? <p className="muted">Loading leaderboard...</p> : null}
      {!isLoading && rows.length === 0 ? null : null}
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
                <span>{getLeaderboardComment(row)}</span>
                <div className="row-chip-list">
                  {buildLeaderboardChips(row).map((chip) => (
                    <span key={`${row.userId}-${chip}`} className="row-chip">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="leaderboard-total">{isKm ? `${Number(row.total).toFixed(1)} km` : row.total}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  )
}

export function ChaseCard({ chase, isLoading, period, compact = false, activityType = 'pressups' }) {
  const isKm = activityType === 'km'
  const unitLabel = isKm ? 'KM' : 'Press-up'

  function formatGap(value) {
    if (value == null) {
      return null
    }

    return isKm ? `${Number(value).toFixed(1)} km` : `${value} reps`
  }

  function formatSuggestedAction() {
    if (isKm) {
      return chase.gapToCatch ? `${Number(chase.gapToCatch).toFixed(1)} km takes the spot.` : 'Build the gap.'
    }

    return chase.suggestedAction
  }

  if (isLoading) {
    return (
      <Card title="The Chase" body="Finding the pressure points on the board.">
        <p className="muted">Loading chase...</p>
      </Card>
    )
  }

  if (chase.state === 'off-board') {
    return (
      <Card title="The Chase" body={`${unitLabel} chase for the current ${period.replace('ly', '')} board.`}>
        <div className="stack">
          <strong>You&apos;re not on the board yet.</strong>
          <p className="muted">Log first. Let the board react.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card title="The Chase" body={`${unitLabel} chase for the current ${period.replace('ly', '')} board.`}>
      <div className={compact ? 'stack chase-stack chase-stack--compact' : 'stack chase-stack'}>
        {chase.currentUserRow?.rank === 1 ? (
          <div className="chase-block">
            <span className="chase-pill">DEFEND</span>
            <strong>You&apos;re holding the crown.</strong>
            <span>Protect your lead.</span>
          </div>
        ) : null}

        {chase.rowAbove ? (
          <div className="chase-block">
            <span className="chase-pill">TARGET</span>
            <strong>You're hunting {chase.rowAbove.actorName}.</strong>
            <span>{formatGap(chase.gapToCatch)} ahead.</span>
            <span>{formatSuggestedAction()}</span>
          </div>
        ) : null}

        {chase.rowBelow ? (
          <div className="chase-block">
            <span className="chase-pill">DEFEND</span>
            <strong>{chase.rowBelow.actorName} is hunting you.</strong>
            <span>{formatGap(chase.gapToDefend)} behind.</span>
            <span>Defend the gap.</span>
          </div>
        ) : null}

        {!chase.rowAbove && !chase.rowBelow ? (
          <div className="chase-block">
            <span className="chase-pill">KEEP</span>
            <strong>You&apos;re alone on the board.</strong>
            <span>Keep logging. Make someone chase.</span>
          </div>
        ) : null}
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
      <Card title="Recent Activity" body="Could not load recent activity.">
        <p className="muted">Try again in a moment.</p>
      </Card>
    )
  }

  return (
    <Card title="Recent Activity" body="Latest five press-up rows. Pending entries land here immediately.">
      {error && rows.length > 0 ? <p className="muted">Could not refresh activity. Try again.</p> : null}
      {isLoading ? <p className="muted">Loading recent activity...</p> : null}
      {!isLoading && rows.length === 0 ? (
        <div className="stack">
          <strong>No movement yet.</strong>
          <p className="muted">Put the first reps on the board.</p>
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
                  <span>{row.pending ? 'Board updating...' : formatSubmissionTimestamp(row.createdAt)}</span>
                </div>
                <div className="activity-meta">
                  <span className="activity-value">{row.value}</span>
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
