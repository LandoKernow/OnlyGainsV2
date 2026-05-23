import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
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

function VaultRecordCard({ title, record, emptyCopy, isPublicVisitor }) {
  return (
    <article className={isPublicVisitor ? 'vault-card vault-record-card vault-record-card--public' : 'vault-card vault-record-card'}>
      <strong>{title}</strong>
      <div className="vault-card__value">
        {formatVaultRecordValue(record, title.includes('KM') || title === 'Longest run' ? 'km' : 'pressups')}
      </div>
      {record ? (
        <>
          <div className="vault-card__holder">{record.actorName || 'Unknown'}</div>
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
  const { showToast } = useToast()
  const { status } = useAuth()
  const { circleId } = useBoardMeta()
  const { records, isLoading, error, currentYear } = useVaultRecords({ circleId })
  const awardsQuery = useVaultAwards(circleId)
  const isPublicVisitor = status === 'unauthenticated'

  const pressupsDay = records.pressupsDay
  const pressupsWeek = records.pressupsWeek
  const kmDay = records.kmDay
  const kmWeek = records.kmWeek
  const claimedRecords = records.claimed ?? {}
  const awards = awardsQuery.awards

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
        <Card
          title="THE VAULT"
          body={isPublicVisitor ? 'Discipline becomes public. Records are remembered. Join the board.' : 'Records are remembered.'}
        >
          <div className="stack">
            <p className="muted">Claimed records are visible. Verified records are coming.</p>
            <p className="muted">The Vault remembers what the Board forgets.</p>
            <Link className="button button--ghost" to={isPublicVisitor ? '/dashboard' : '/profile/records'}>
              {isPublicVisitor ? 'Join the board' : 'View your records'}
            </Link>
          </div>
        </Card>

        <div className="vault-intro">
          <p className="vault-intro__eyebrow">{currentYear} RECORDS</p>
          <p className="vault-intro__copy">App-tracked live. Claimed records clearly labelled.</p>
        </div>

        {!isLoading && !error ? (
          <>
            <Card title="APP-TRACKED" body="Earned through live submissions.">
              <div className="vault-records">
                <VaultRecordCard
                  title="Most press-ups / day"
                  record={pressupsDay}
                  emptyCopy="No holder yet. Log enough to leave a mark."
                  isPublicVisitor={isPublicVisitor}
                />
                <VaultRecordCard
                  title="Most press-ups / week"
                  record={pressupsWeek}
                  emptyCopy="No holder yet. Log enough to leave a mark."
                  isPublicVisitor={isPublicVisitor}
                />
                <VaultRecordCard
                  title="Most KM / day"
                  record={kmDay}
                  emptyCopy="No holder yet. Log enough to leave a mark."
                  isPublicVisitor={isPublicVisitor}
                />
                <VaultRecordCard
                  title="Most KM / week"
                  record={kmWeek}
                  emptyCopy="No holder yet. Log enough to leave a mark."
                  isPublicVisitor={isPublicVisitor}
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
                  />
                ))}
              </div>
            </Card>

            {!awardsQuery.error ? (
              <Card title="AWARDS" body="Final wins are written into the Vault.">
                <div className="stack">
                  {awards.length > 0 ? (
                    awards.map((award) => (
                      <article key={award.id} className="vault-card">
                        <strong>{award.title}</strong>
                        <div className="vault-card__holder">{award.actorName}</div>
                        <div className="vault-card__value">{formatAwardMetricLine(award)}</div>
                        {formatAwardPeriodRange(award) ? <p className="muted">{formatAwardPeriodRange(award)}</p> : null}
                        {award.quote ? <p className="muted">{award.quote}</p> : null}
                        <p className="muted">{formatAwardSourceLabel(award)}</p>
                        <div className="vault-award-card__actions">
                          <Link className="button button--ghost vault-award-card__button" to={`/award/${award.id}`}>
                            View
                          </Link>
                          <button className="button vault-award-card__button" type="button" onClick={() => handleShareAward(award)}>
                            Share
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="stack">
                      <strong>No final wins stored yet.</strong>
                      <p className="muted">Finalise a week or month to write names into the Vault.</p>
                    </div>
                  )}
                </div>
              </Card>
            ) : null}
          </>
        ) : null}

        {isLoading ? <p className="muted">Loading Vault records...</p> : null}
        {error ? <p className="muted">Unable to load Vault records.</p> : null}

        <VaultFutureSection />
      </div>
    </div>
  )
}
