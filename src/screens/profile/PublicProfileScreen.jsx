import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { useAuth } from '../../features/auth/AuthProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { usePublicProfileSummary } from '../../hooks/usePublicProfileSummary'
import { formatActivityValue } from '../../utils/activity'
import { formatAwardLandingCopy, formatAwardMetricLine, formatAwardPeriodRange } from '../../utils/awardShare'
import { formatDurationFromSeconds, PROFILE_YEAR_RECORD_LABELS } from '../../utils/profileYear'

function formatRecordLine(record) {
  if (record.unit === 'seconds') {
    return `${PROFILE_YEAR_RECORD_LABELS[record.recordType]} - ${formatDurationFromSeconds(record.valueSeconds)}`
  }

  if (record.unit === 'km') {
    return `${PROFILE_YEAR_RECORD_LABELS[record.recordType]} - ${formatActivityValue(record.valueNumeric, 'km')}`
  }

  return `${PROFILE_YEAR_RECORD_LABELS[record.recordType]} - ${formatActivityValue(record.valueNumeric, 'pressups')}`
}

function getBoardStatus(summary, activityType) {
  const row = summary?.leaderboard?.[activityType]

  if (row?.rank === 1) {
    return 'CROWN'
  }

  if (summary?.profile?.boardStatus) {
    return String(summary.profile.boardStatus).replace(/_/g, ' ').toUpperCase()
  }

  if (row) {
    return 'ACTIVE'
  }

  return 'QUIET'
}

export default function PublicProfileScreen() {
  const { userId = '' } = useParams()
  const { status, session } = useAuth()
  const { circleId } = useBoardMeta()
  const summaryQuery = usePublicProfileSummary({ circleId, userId, year: 2026 })
  const [activityType, setActivityType] = useState('pressups')
  const summary = summaryQuery.summary
  const profile = summary?.profile
  const currentRow = summary?.leaderboard?.[activityType] ?? null
  const isViewingSelf = status === 'authenticated' && session?.user?.id === userId
  const joinedYear = profile?.createdAt ? new Date(profile.createdAt).getFullYear() : null

  return (
    <div className="screen screen--profile">
      <div className="stack-lg">
        <Card title={profile?.name || 'Board member'} body="Discipline made public.">
          <div className="stack public-profile-hero">
            <div className="modal-summary">
              <span>{getBoardStatus(summary, activityType)}</span>
              {joinedYear ? <span>Joined {joinedYear}</span> : <span>Public profile</span>}
            </div>
            <div className="award-stage__actions--stacked">
              {status === 'unauthenticated' ? (
                <Link className="button award-stage__primary" to="/dashboard">
                  Join the board
                </Link>
              ) : isViewingSelf ? (
                <Link className="button award-stage__primary" to="/profile/year/2026">
                  Build 2026 profile
                </Link>
              ) : (
                <Link className="button award-stage__primary" to="/leaderboard">
                  View ranks
                </Link>
              )}
              <div className="award-stage__secondary">
                <Link className="button button--ghost" to="/vault">
                  View Vault
                </Link>
              </div>
            </div>
          </div>
        </Card>

        <Card title="CURRENT BOARD" body="Status earned live.">
          <div className="record-tabs">
            <button
              className={activityType === 'pressups' ? 'record-tab record-tab--active' : 'record-tab'}
              type="button"
              onClick={() => setActivityType('pressups')}
            >
              Press Ups
            </button>
            <button
              className={activityType === 'pullups' ? 'record-tab record-tab--active' : 'record-tab'}
              type="button"
              onClick={() => setActivityType('pullups')}
            >
              Pull Ups
            </button>
            <button
              className={activityType === 'km' ? 'record-tab record-tab--active' : 'record-tab'}
              type="button"
              onClick={() => setActivityType('km')}
            >
              KM
            </button>
          </div>
          <div className="stack section-gap">
            {currentRow ? (
              <>
                <strong>#{currentRow.rank} this week</strong>
                <span>{formatActivityValue(currentRow.total, activityType)}</span>
              </>
            ) : (
              <>
                <strong>Not on the board yet.</strong>
                <span className="muted">No current weekly mark visible.</span>
              </>
            )}
          </div>
        </Card>

        <Card title="AWARDS" body="Final wins written into the Vault.">
          <div className="public-profile-awards">
            <strong>{summary?.awardsCount ?? 0} wins written into the Vault</strong>
            {(summary?.awards ?? []).slice(0, 4).map((award) => (
              <article key={award.id} className="public-profile-award">
                <strong>{award.title}</strong>
                <div className="vault-card__value">{formatAwardMetricLine(award)}</div>
                {formatAwardPeriodRange(award) ? <p className="muted">{formatAwardPeriodRange(award)}</p> : null}
                <p className="muted">{formatAwardLandingCopy(award)}</p>
              </article>
            ))}
            {summary?.awardsCount === 0 ? <p className="muted">No awards written yet.</p> : null}
          </div>
        </Card>

        <Card title="VAULT MARKS" body="Proof that stays on the wall.">
          <div className="public-profile-records">
            {(summary?.topPublicRecords ?? []).map((record) => (
              <div key={record.id} className="records-wall-row">
                <strong>{formatRecordLine(record)}</strong>
                <span className="muted">
                  {String(record.sourceLabel || '').replace(/_/g, '-').toUpperCase()} - {record.year}
                </span>
              </div>
            ))}
            {!summary?.topPublicRecords?.length ? (
              <p className="muted">No public marks visible yet.</p>
            ) : null}
          </div>
        </Card>

        {summaryQuery.isLoading ? <p className="muted">Loading public profile.</p> : null}
        {summaryQuery.error ? <p className="muted">Some public profile data is limited right now.</p> : null}
      </div>
    </div>
  )
}
