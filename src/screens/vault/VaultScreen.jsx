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
import {
  formatAwardMetricLine,
  formatAwardPeriodRange,
  formatAwardSourceLabel,
  shareAward,
} from '../../utils/awardShare'
import { formatDurationFromSeconds, PROFILE_YEAR_RECORD_LABELS } from '../../utils/profileYear'

const CLAIMED_RECORD_TYPES = [
  'pressups_set',
  'pullups_day',
  'pullups_week',
  'pullups_set',
  'fastest_5k',
  'fastest_10k',
  'half_marathon',
  'marathon',
  'longest_run',
]

function formatSourceLabel(sourceLabel) {
  return String(sourceLabel || '').replace(/_/g, '-').toUpperCase()
}

function formatVaultRecordValue(record, fallbackActivityType = 'pressups') {
  if (!record) {
    return 'No record yet'
  }

  if (record.unit === 'seconds') {
    return formatDurationFromSeconds(record.valueSeconds)
  }

  if (record.unit === 'km') {
    return formatActivityValue(record.valueNumeric ?? record.value, 'km')
  }

  return formatActivityValue(record.valueNumeric ?? record.value, fallbackActivityType)
}

function FeaturedAwardCard({ award, onPreviewWinner, onShare }) {
  return (
    <article className="vault-award-featured">
      <p className="vault-award-featured__eyebrow">LATEST AWARD</p>
      <strong className="vault-award-featured__title">{award.title}</strong>
      <button className="profile-link-button vault-award-featured__winner" type="button" onClick={onPreviewWinner}>
        {award.actorName}
      </button>
      <div className="vault-award-featured__value">{formatAwardMetricLine(award)}</div>
      {formatAwardPeriodRange(award) ? <p className="vault-award-featured__period">{formatAwardPeriodRange(award)}</p> : null}
      <p className="vault-award-featured__quote">{award.quote || 'Name in the Vault.'}</p>
      <p className="vault-award-featured__source">{formatAwardSourceLabel(award)}</p>
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
          {award.title} <span aria-hidden="true">·</span>{' '}
          <button className="profile-link-button" type="button" onClick={onPreviewWinner}>
            {award.actorName}
          </button>{' '}
          <span aria-hidden="true">·</span> {formatAwardMetricLine(award)}
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
    <Card title="AWARDS" body="Final wins are written into the Vault.">
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
                  Previous awards {isExpanded ? '▴' : '▾'}
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
          <div className="stack">
            <strong>No final wins stored yet.</strong>
            <p className="muted">Finalise a week or month to write names into the Vault.</p>
          </div>
        )}
      </div>
    </Card>
  )
}

function VaultRecordCard({ title, record, emptyCopy, isPublicVisitor, onPreviewHolder }) {
  if (record && isPublicVisitor) {
    return (
      <article className="vault-card vault-record-card vault-record-card--public">
        <strong>{title}</strong>
        <div className="vault-record-card__inline">
          <span className="vault-card__value">{formatVaultRecordValue(record, title.includes('KM') || title === 'Longest run' ? 'km' : 'pressups')}</span>
          <span className="vault-card__inline-dot" aria-hidden="true">
            &middot;
          </span>
          <button className="profile-link-button vault-card__holder" type="button" onClick={onPreviewHolder}>
            {record.actorName || 'Unknown'}
          </button>
        </div>
        <div className="vault-card__status">
          {formatSourceLabel(record.sourceLabel)} <span aria-hidden="true">&middot;</span> {record.year}
        </div>
      </article>
    )
  }

  return (
    <article className={isPublicVisitor ? 'vault-card vault-record-card vault-record-card--public' : 'vault-card vault-record-card'}>
      <strong>{title}</strong>
      <div className="vault-card__value">
        {formatVaultRecordValue(record, title.includes('KM') || title === 'Longest run' ? 'km' : 'pressups')}
      </div>
      {record ? (
        <>
          <button className="profile-link-button vault-card__holder" type="button" onClick={onPreviewHolder}>
            {record.actorName || 'Unknown'}
          </button>
          <div className="vault-card__status">
            {formatSourceLabel(record.sourceLabel)} <span aria-hidden="true">&middot;</span> {record.year}
          </div>
        </>
      ) : (
        <div className="stack">
          <div className="vault-card__empty">{emptyCopy}</div>
          <Link className="button button--ghost vault-card__action" to={isPublicVisitor ? '/dashboard' : '/profile/records'}>
            {isPublicVisitor ? 'Join the board' : 'View your records'}
          </Link>
        </div>
      )}
    </article>
  )
}

function VaultFutureSection() {
  const futureTitles = ['Verified claims', 'Proof flow', 'Year-over-year comparisons']

  return (
    <Card title="COMING NEXT" body="The Vault gets sharper from here.">
      <div className="vault-future">
        {futureTitles.map((title) => (
          <span key={title} className="vault-future-chip">
            {title}
          </span>
        ))}
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

  const pressupsDay = records.pressupsDay
  const pressupsWeek = records.pressupsWeek
  const kmDay = records.kmDay
  const kmWeek = records.kmWeek
  const claimedRecords = records.claimed ?? {}
  const awards = awardsQuery.awards
  const appTrackedEmptyCopy = appTrackedUnavailable
    ? 'App-tracked records are being rebuilt.'
    : 'No holder yet. Log enough to leave a mark.'

  function openProfilePreview(userId, actorName, activityType = 'pressups') {
    if (!userId) {
      return
    }

    setPreviewState({
      userId,
      actorName,
      activityType,
    })
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

  return (
    <div className={isPublicVisitor ? 'screen screen--vault screen--vault-public' : 'screen screen--vault'}>
      <div className="stack-lg">
        {isPublicVisitor ? (
          <Card title="THE VAULT" body="Records are remembered. Crowns are written here. Join the board.">
            <div className="stack">
              <p className="eyebrow">ONLY GAINS</p>
              <p className="vault-public-hero__line">Discipline becomes public.</p>
              <div className="vault-public-hero__actions">
                <Link className="button" to="/dashboard">
                  Join the board
                </Link>
                <a className="button button--ghost" href="#vault-records">
                  View records
                </a>
              </div>
            </div>
          </Card>
        ) : (
          <Card title="THE VAULT" body="Records are remembered.">
            <div className="stack">
              <p className="muted">Claimed records are visible. Verified records are coming.</p>
              <p className="muted">The Vault remembers what the Board forgets.</p>
              <Link className="button button--ghost" to="/profile/records">
                View your records
              </Link>
            </div>
          </Card>
        )}

        <div className="vault-intro">
          <p className="vault-intro__eyebrow">{currentYear} RECORDS</p>
          <p className="vault-intro__copy">App-tracked live. Claimed records clearly labelled.</p>
          {isPublicVisitor ? <p className="vault-intro__copy">Think you can beat one? Join the board.</p> : null}
        </div>

        {!isLoading && !error ? (
          isPublicVisitor ? (
            <>
              {!awardsQuery.error ? (
                <VaultAwardsSection
                  awards={awards}
                  error={awardsQuery.error}
                  onPreviewWinner={(award) => openProfilePreview(award.userId, award.actorName, award.activityType === 'km' ? 'km' : 'pressups')}
                  onShareAward={handleShareAward}
                />
              ) : null}

              <Card title="APP-TRACKED" body="Earned through live submissions.">
                {appTrackedUnavailable ? <p className="muted">App-tracked records are being rebuilt.</p> : null}
                <div className="vault-records">
                  <div id="vault-records" />
                  <VaultRecordCard
                    title="Most press-ups / day"
                    record={pressupsDay}
                    emptyCopy={appTrackedEmptyCopy}
                    isPublicVisitor={isPublicVisitor}
                    onPreviewHolder={() => openProfilePreview(pressupsDay?.userId, pressupsDay?.actorName, 'pressups')}
                  />
                  <VaultRecordCard
                    title="Most press-ups / week"
                    record={pressupsWeek}
                    emptyCopy={appTrackedEmptyCopy}
                    isPublicVisitor={isPublicVisitor}
                    onPreviewHolder={() => openProfilePreview(pressupsWeek?.userId, pressupsWeek?.actorName, 'pressups')}
                  />
                  <VaultRecordCard
                    title="Most KM / day"
                    record={kmDay}
                    emptyCopy={appTrackedEmptyCopy}
                    isPublicVisitor={isPublicVisitor}
                    onPreviewHolder={() => openProfilePreview(kmDay?.userId, kmDay?.actorName, 'km')}
                  />
                  <VaultRecordCard
                    title="Most KM / week"
                    record={kmWeek}
                    emptyCopy={appTrackedEmptyCopy}
                    isPublicVisitor={isPublicVisitor}
                    onPreviewHolder={() => openProfilePreview(kmWeek?.userId, kmWeek?.actorName, 'km')}
                  />
                </div>
              </Card>

              <Card title="CLAIMED RECORDS" body="Self-reported until verified.">
                <div className="vault-records">
                  {CLAIMED_RECORD_TYPES.map((recordType) => (
                    <VaultRecordCard
                      key={recordType}
                      title={PROFILE_YEAR_RECORD_LABELS[recordType]}
                      record={claimedRecords[recordType] ?? null}
                      emptyCopy="No holder yet. Claim it from your 2026 profile."
                      isPublicVisitor={isPublicVisitor}
                      onPreviewHolder={() => openProfilePreview(claimedRecords[recordType]?.userId, claimedRecords[recordType]?.actorName)}
                    />
                  ))}
                </div>
                <div className="section-gap">
                  <Link className="button button--ghost" to="/dashboard">
                    Think you can beat one? Join the board.
                  </Link>
                </div>
              </Card>
            </>
          ) : (
            <>
              <Card title="APP-TRACKED" body="Earned through live submissions.">
                {appTrackedUnavailable ? <p className="muted">App-tracked records are being rebuilt.</p> : null}
                <div className="vault-records">
                  <div id="vault-records" />
                  <VaultRecordCard
                    title="Most press-ups / day"
                    record={pressupsDay}
                    emptyCopy={appTrackedEmptyCopy}
                    isPublicVisitor={isPublicVisitor}
                    onPreviewHolder={() => openProfilePreview(pressupsDay?.userId, pressupsDay?.actorName, 'pressups')}
                  />
                  <VaultRecordCard
                    title="Most press-ups / week"
                    record={pressupsWeek}
                    emptyCopy={appTrackedEmptyCopy}
                    isPublicVisitor={isPublicVisitor}
                    onPreviewHolder={() => openProfilePreview(pressupsWeek?.userId, pressupsWeek?.actorName, 'pressups')}
                  />
                  <VaultRecordCard
                    title="Most KM / day"
                    record={kmDay}
                    emptyCopy={appTrackedEmptyCopy}
                    isPublicVisitor={isPublicVisitor}
                    onPreviewHolder={() => openProfilePreview(kmDay?.userId, kmDay?.actorName, 'km')}
                  />
                  <VaultRecordCard
                    title="Most KM / week"
                    record={kmWeek}
                    emptyCopy={appTrackedEmptyCopy}
                    isPublicVisitor={isPublicVisitor}
                    onPreviewHolder={() => openProfilePreview(kmWeek?.userId, kmWeek?.actorName, 'km')}
                  />
                </div>
              </Card>

              <Card title="CLAIMED RECORDS" body="Self-reported until verified.">
                <div className="vault-records">
                  {CLAIMED_RECORD_TYPES.map((recordType) => (
                    <VaultRecordCard
                      key={recordType}
                      title={PROFILE_YEAR_RECORD_LABELS[recordType]}
                      record={claimedRecords[recordType] ?? null}
                      emptyCopy="No holder yet. Claim it from your 2026 profile."
                      isPublicVisitor={isPublicVisitor}
                      onPreviewHolder={() => openProfilePreview(claimedRecords[recordType]?.userId, claimedRecords[recordType]?.actorName)}
                    />
                  ))}
                </div>
              </Card>

              {!awardsQuery.error ? (
                <VaultAwardsSection
                  awards={awards}
                  error={awardsQuery.error}
                  onPreviewWinner={(award) => openProfilePreview(award.userId, award.actorName, award.activityType === 'km' ? 'km' : 'pressups')}
                  onShareAward={handleShareAward}
                />
              ) : null}
            </>
          )
        ) : null}

        {isLoading ? <p className="muted">Loading Vault records...</p> : null}
        {error ? <p className="muted">Unable to load Vault records.</p> : null}

        <VaultFutureSection />
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
