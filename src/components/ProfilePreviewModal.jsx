import { useNavigate } from 'react-router-dom'
import { useBoardMeta } from '../hooks/useBoardMeta'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { usePublicProfileSummary } from '../hooks/usePublicProfileSummary'
import { formatActivityValue } from '../utils/activity'
import { normalizeActivityType } from '../utils/activityTypes'
import { formatDurationFromSeconds, PROFILE_YEAR_RECORD_LABELS } from '../utils/profileYear'

function formatPreviewRecord(record) {
  if (!record) {
    return 'No public mark yet.'
  }

  if (record.unit === 'seconds') {
    return `${PROFILE_YEAR_RECORD_LABELS[record.recordType]}: ${formatDurationFromSeconds(record.valueSeconds)}`
  }

  if (record.unit === 'km') {
    return `${PROFILE_YEAR_RECORD_LABELS[record.recordType]}: ${formatActivityValue(record.valueNumeric, 'km')}`
  }

  return `${PROFILE_YEAR_RECORD_LABELS[record.recordType]}: ${formatActivityValue(record.valueNumeric, 'pressups')}`
}

function getBoardStatus(profile, currentRow) {
  if (profile?.boardStatus) {
    return String(profile.boardStatus).replace(/_/g, ' ').toUpperCase()
  }

  if (currentRow?.rank === 1) {
    return 'CROWN'
  }

  if (currentRow) {
    return 'ACTIVE'
  }

  return 'QUIET'
}

export function ProfilePreviewModal({
  userId,
  initialName = 'Board member',
  initialRank = null,
  initialWeeklyTotal = null,
  initialActivityType = 'pressups',
  onClose,
}) {
  const navigate = useNavigate()
  const { circleId } = useBoardMeta()
  useEscapeKey(onClose, Boolean(userId))
  const summaryQuery = usePublicProfileSummary({ circleId, userId, year: 2026 })
  const summary = summaryQuery.summary
  const profile = summary?.profile
  const currentRow =
    summary?.leaderboard?.[normalizeActivityType(initialActivityType)] ?? null
  const displayName = profile?.name || initialName || 'Board member'
  const displayRank = currentRow?.rank ?? initialRank
  const displayTotal = currentRow?.total ?? initialWeeklyTotal
  const statusLabel = getBoardStatus(profile, currentRow)

  function handleViewProfile() {
    navigate(`/u/${userId}`)
    onClose?.()
  }

  if (!userId) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet profile-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="stack">
          <div>
            <h2 id="profile-preview-title" className="modal-title">
              {displayName}
            </h2>
            <p className="muted">Discipline made public.</p>
          </div>

          <div className="modal-summary">
            <span>{statusLabel}</span>
            {displayRank ? <span>#{displayRank} this week</span> : null}
            {displayTotal != null ? <span>{formatActivityValue(displayTotal, initialActivityType)}</span> : null}
          </div>

          <div className="profile-preview-grid">
            <div className="profile-preview-grid__row">
              <span className="muted">Vault claims</span>
              <strong>{summary?.vaultClaimsCount ?? 0}</strong>
            </div>
            <div className="profile-preview-grid__row">
              <span className="muted">Awards</span>
              <strong>{summary?.awardsCount ?? 0}</strong>
            </div>
            <div className="profile-preview-grid__row">
              <span className="muted">Top mark</span>
              <strong>{formatPreviewRecord(summary?.topPublicRecords?.[0] ?? null)}</strong>
            </div>
          </div>

          {summaryQuery.isLoading ? <p className="muted">Loading public profile.</p> : null}

          <div className="modal-actions">
            <button className="button" type="button" onClick={handleViewProfile}>
              View full profile
            </button>
            <button className="button button--ghost" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
