import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { ProfilePreviewModal } from '../../components/ProfilePreviewModal'
import { useToast } from '../../components/ToastProvider'
import { useAuth } from '../../features/auth/AuthProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useVaultAwards } from '../../hooks/useVaultAwards'
import { useVaultRecords } from '../../hooks/useVaultRecords'
import { formatActivityValue } from '../../utils/activity'
import { normalizeActivityType } from '../../utils/activityTypes'
import { formatAwardMetricLine, formatAwardPeriodRange, shareAward } from '../../utils/awardShare'
import { formatDurationFromSeconds } from '../../utils/profileYear'
import { TELEGRAM_URL } from '../../utils/community'

// Trophy room rules: huge number, tiny label, no sentences.
const APP_TRACKED_TROPHIES = [
  { key: 'pressupsDay', label: 'PRESS-UPS · DAY', activityType: 'pressups' },
  { key: 'pressupsWeek', label: 'PRESS-UPS · WEEK', activityType: 'pressups' },
  { key: 'pullupsDay', label: 'PULL-UPS · DAY', activityType: 'pullups' },
  { key: 'pullupsWeek', label: 'PULL-UPS · WEEK', activityType: 'pullups' },
  { key: 'kmDay', label: 'KM · DAY', activityType: 'km' },
  { key: 'kmWeek', label: 'KM · WEEK', activityType: 'km' },
]

const CLAIMED_TROPHIES = [
  { key: 'pressups_set', label: 'PRESS-UPS · SET', activityType: 'pressups' },
  { key: 'pullups_day', label: 'PULL-UPS · DAY', activityType: 'pullups' },
  { key: 'pullups_week', label: 'PULL-UPS · WEEK', activityType: 'pullups' },
  { key: 'pullups_set', label: 'PULL-UPS · SET', activityType: 'pullups' },
  { key: 'fastest_5k', label: '5K', activityType: 'pressups' },
  { key: 'fastest_10k', label: '10K', activityType: 'pressups' },
  { key: 'half_marathon', label: 'HALF MARATHON', activityType: 'pressups' },
  { key: 'marathon', label: 'MARATHON', activityType: 'pressups' },
  { key: 'longest_run', label: 'LONGEST RUN', activityType: 'km' },
]

function formatTrophyValue(record, fallbackActivityType) {
  if (!record) {
    return '—'
  }

  if (record.unit === 'seconds') {
    return formatDurationFromSeconds(record.valueSeconds)
  }

  if (record.unit === 'km') {
    return formatActivityValue(record.valueNumeric ?? record.value, 'km')
  }

  return formatActivityValue(record.valueNumeric ?? record.value, fallbackActivityType)
}

function sourceTag(record) {
  const label = String(record?.sourceLabel || '')
  return label === 'app_tracked' ? 'LIVE' : 'CLAIMED'
}

function Trophy({ label, record, activityType, onPreviewHolder }) {
  return (
    <article className={record ? 'trophy' : 'trophy trophy--empty'}>
      <span className="trophy__label">{label}</span>
      <strong className="trophy__value">{formatTrophyValue(record, activityType)}</strong>
      {record ? (
        <>
          <button className="trophy__holder" type="button" onClick={onPreviewHolder}>
            {record.actorName || 'Unknown'}
          </button>
          <span className="trophy__tag">
            {sourceTag(record)} · {record.year}
          </span>
        </>
      ) : (
        <span className="trophy__tag trophy__tag--empty">UNCLAIMED</span>
      )}
    </article>
  )
}

function FeaturedAwardCard({ award, onPreviewWinner, onShare }) {
  return (
    <article className="vault-award-featured">
      <p className="vault-award-featured__eyebrow">LATEST AWARD</p>
      <strong className="vault-award-featured__title">{award.title}</strong>
      <div className="vault-award-featured__value">{formatAwardMetricLine(award)}</div>
      <button className="profile-link-button vault-award-featured__winner" type="button" onClick={onPreviewWinner}>
        {award.actorName}
      </button>
      {formatAwardPeriodRange(award) ? <p className="vault-award-featured__period">{formatAwardPeriodRange(award)}</p> : null}
      <div className="vault-award-card__actions">
        <Link className="button button--ghost vault-award-card__button" to={`/award/${award.id}`}>
          View
        </Link>
        <button className="button vault-award-card__button" type="button" onClick={onShare}>
          Share
        </button>
      </div>
    </article>
  )
}

function PreviousAwardRow({ award, onPreviewWinner, onShare }) {
  return (
    <article className="vault-award-row">
      <div className="stack">
        <strong className="vault-award-row__headline">
          {award.title} <span aria-hidden="true">&middot;</span>{' '}
          <button className="profile-link-button" type="button" onClick={onPreviewWinner}>
            {award.actorName}
          </button>{' '}
          <span aria-hidden="true">&middot;</span> {formatAwardMetricLine(award)}
        </strong>
        {formatAwardPeriodRange(award) ? <p className="muted">{formatAwardPeriodRange(award)}</p> : null}
      </div>
      <div className="vault-award-card__actions">
        <Link className="button button--ghost vault-award-card__button" to={`/award/${award.id}`}>
          View
        </Link>
        <button className="button vault-award-card__button" type="button" onClick={onShare}>
          Share
        </button>
      </div>
    </article>
  )
}

function VaultAwardsSection({ awards, error, onPreviewWinner, onShareAward }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (error) {
    return null
  }

  return (
    <Card title="AWARDS">
      <div className="stack">
        {awards.length > 0 ? (
          <>
            <FeaturedAwardCard
              award={awards[0]}
              onPreviewWinner={() => onPreviewWinner(awards[0])}
              onShare={() => onShareAward(awards[0])}
            />
            {awards.length > 1 ? (
              <div className="vault-awards-history">
                <button
                  className="vault-awards-history__toggle"
                  type="button"
                  onClick={() => setIsExpanded((current) => !current)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? 'Hide previous' : `Previous (${awards.length - 1})`}
                </button>
                {isExpanded ? (
                  <div className="stack">
                    {awards.slice(1).map((award) => (
                      <PreviousAwardRow
                        key={award.id}
                        award={award}
                        onPreviewWinner={() => onPreviewWinner(award)}
                        onShare={() => onShareAward(award)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">Nothing written yet.</p>
        )}
      </div>
    </Card>
  )
}

export default function VaultScreen() {
  const [previewState, setPreviewState] = useState(null)
  const { showToast } = useToast()
  const { status } = useAuth()
  const { circleId } = useBoardMeta()
  const { records, isLoading, error, currentYear, appTrackedUnavailable } = useVaultRecords({ circleId })
  const awardsQuery = useVaultAwards(circleId)
  const isPublicVisitor = status === 'unauthenticated'
  const claimedRecords = records.claimed ?? {}

  function openProfilePreview(userId, actorName, activityType = 'pressups') {
    if (!userId) {
      return
    }

    setPreviewState({ userId, actorName, activityType })
  }

  async function handleShareAward(award) {
    try {
      const result = await shareAward(award)
      if (result === 'cancelled') {
        return
      }

      showToast({
        tone: 'success',
        message: result === 'shared' ? 'Award shared.' : 'Share link copied.',
      })
    } catch {
      showToast({ tone: 'error', message: 'Could not share award.' })
    }
  }

  const appTrackedCard = (
    <Card title={`LIVE RECORDS · ${currentYear}`}>
      {appTrackedUnavailable ? <p className="muted">Rebuilding.</p> : null}
      <div className="trophy-grid" id="vault-records">
        {APP_TRACKED_TROPHIES.map((trophy) => (
          <Trophy
            key={trophy.key}
            label={trophy.label}
            record={records[trophy.key]}
            activityType={trophy.activityType}
            onPreviewHolder={() =>
              openProfilePreview(records[trophy.key]?.userId, records[trophy.key]?.actorName, trophy.activityType)
            }
          />
        ))}
      </div>
    </Card>
  )

  const claimedCard = (
    <Card title="CLAIMED RECORDS">
      <div className="trophy-grid">
        {CLAIMED_TROPHIES.map((trophy) => (
          <Trophy
            key={trophy.key}
            label={trophy.label}
            record={claimedRecords[trophy.key] ?? null}
            activityType={trophy.activityType}
            onPreviewHolder={() =>
              openProfilePreview(claimedRecords[trophy.key]?.userId, claimedRecords[trophy.key]?.actorName)
            }
          />
        ))}
      </div>
      <div className="section-gap vault-actions-row">
        {isPublicVisitor ? (
          <Link className="button" to="/dashboard">
            Join the board
          </Link>
        ) : (
          <Link className="button button--ghost" to="/profile/records">
            Your records
          </Link>
        )}
      </div>
    </Card>
  )

  const awardsSection = !awardsQuery.error ? (
    <VaultAwardsSection
      awards={awardsQuery.awards}
      error={awardsQuery.error}
      onPreviewWinner={(award) => openProfilePreview(award.userId, award.actorName, normalizeActivityType(award.activityType))}
      onShareAward={handleShareAward}
    />
  ) : null

  return (
    <div className={isPublicVisitor ? 'screen screen--vault screen--vault-public' : 'screen screen--vault'}>
      <div className="stack-lg">
        <div className="vault-kicker">
          <p className="vault-kicker__eyebrow">ONLY GAINS</p>
          <h2 className="vault-kicker__title">THE VAULT</h2>
          {isPublicVisitor ? (
            <Link className="button vault-kicker__cta" to="/dashboard">
              Join the board
            </Link>
          ) : null}
        </div>

        {!isLoading && !error ? (
          isPublicVisitor ? (
            <>
              {awardsSection}
              {appTrackedCard}
              {claimedCard}
            </>
          ) : (
            <>
              {appTrackedCard}
              {claimedCard}
              {awardsSection}
            </>
          )
        ) : null}

        {isLoading ? <p className="muted">Opening the Vault...</p> : null}
        {error ? <p className="muted">Vault unreachable. Refresh.</p> : null}

        <p className="vault-footer-link">
          <a className="subtle-link" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
            Enter the Telegram
          </a>
        </p>
      </div>
      {previewState ? (
        <ProfilePreviewModal
          userId={previewState.userId}
          initialName={previewState.actorName}
          initialActivityType={previewState.activityType}
          onClose={() => setPreviewState(null)}
        />
      ) : null}
    </div>
  )
}
