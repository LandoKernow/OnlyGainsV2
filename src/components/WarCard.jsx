import { formatActivityValue } from '../utils/activity'
import { useEscapeKey } from '../hooks/useEscapeKey'

// The screenshot artifact. Pops after a log. Designed to be screamed at a
// camera roll and posted to a story — so it carries the brand + URL on it.
export function WarCard({ card, onShare, onCallout, onClose }) {
  useEscapeKey(onClose, Boolean(card))

  if (!card) {
    return null
  }

  const {
    warriorName,
    boardName,
    activityType,
    value,
    tier,
    rank,
    weeklyTotal,
    streakDays,
    rivalName,
    gapLabel,
    tagline,
    milestone,
    combo,
    levelLabel,
    shareState,
  } = card

  const rankLabel = Number.isFinite(rank) && rank > 0 ? `#${rank}` : 'UNRANKED'

  return (
    <div className="war-card-backdrop" role="presentation" onClick={onClose}>
      <div
        className="war-card"
        role="dialog"
        aria-modal="true"
        aria-label="War card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="war-card__scanlines" aria-hidden="true" />

        <div className="war-card__head">
          <span className="war-card__brand">ONLY GAINS</span>
          <span className="war-card__tier">{tier}</span>
        </div>

        <div className="war-card__hit">
          <span className="war-card__hit-eyebrow">REP COUNTED. WEAKNESS DENIED.</span>
          <strong className="war-card__hit-value">+{formatActivityValue(value, activityType)}</strong>
          <span className="war-card__warrior">{warriorName}</span>
          {levelLabel ? <span className="war-card__level">{levelLabel}</span> : null}
        </div>

        {milestone ? <div className="war-card__milestone">{milestone}</div> : null}
        {!milestone && combo >= 2 ? <div className="war-card__milestone">×{combo} HEAVY COMBO. STILL HUNGRY.</div> : null}

        <div className="war-card__stats">
          <div className="war-card__stat">
            <span className="war-card__stat-label">RANK</span>
            <strong className="war-card__stat-value">{rankLabel}</strong>
          </div>
          <div className="war-card__stat">
            <span className="war-card__stat-label">WEEK</span>
            <strong className="war-card__stat-value">{formatActivityValue(weeklyTotal, activityType)}</strong>
          </div>
          <div className="war-card__stat">
            <span className="war-card__stat-label">STREAK</span>
            <strong className="war-card__stat-value">{streakDays > 0 ? `${streakDays}🔥` : '—'}</strong>
          </div>
        </div>

        <p className="war-card__tagline">{tagline}</p>

        <div className="war-card__footer" aria-hidden="true">
          <span>{boardName}</span>
          <span>onlygains.club</span>
        </div>

        <div className="war-card__actions">
          <button
            className="button war-card__share"
            type="button"
            onClick={onShare}
            disabled={shareState === 'pending'}
          >
            {shareState === 'pending'
              ? 'BUILDING CARD...'
              : shareState === 'shared'
                ? 'SENT.'
                : shareState === 'downloaded'
                  ? 'SAVED. POST IT.'
                  : shareState === 'copied'
                    ? 'COPIED. POST IT.'
                    : 'SHARE THE PROOF'}
          </button>
          {rivalName ? (
            <button className="button button--ghost war-card__callout" type="button" onClick={onCallout}>
              CALL OUT {rivalName.toUpperCase()}
            </button>
          ) : null}
          <button className="war-card__dismiss" type="button" onClick={onClose}>
            Back to the board
          </button>
        </div>
      </div>
    </div>
  )
}
