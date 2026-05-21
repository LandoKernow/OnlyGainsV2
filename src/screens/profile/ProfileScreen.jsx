import { Link } from 'react-router-dom'
import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { ProfileBasicsCard } from '../../features/profile/ProfileBasicsCard'
import { useAuth } from '../../features/auth/AuthProvider'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { useProfileYearSetup } from '../../hooks/useProfileYearSetup'
import { useToast } from '../../components/ToastProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useActivityLeaderboard } from '../../hooks/useActivityLeaderboard'
import { useChase } from '../../hooks/useChase'
import { formatActivityGap, formatActivityValue } from '../../utils/activity'
import { getRowStatus, getStatusTone } from '../../utils/status'

function ProfileSummary() {
  const { session, signOut } = useAuth()
  const { circleId } = useBoardMeta()
  const profileQuery = useCurrentProfile()
  const profileYearSetup = useProfileYearSetup(2026)
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    currentUserId: session?.user?.id,
    period: 'weekly',
    activityType: 'pressups',
  })
  const chase = useChase(leaderboardQuery.rows, session?.user?.id, 'pressups')
  const profileName = profileQuery.data?.name || session?.user?.email?.split('@')[0] || 'Warrior'
  const currentRow = leaderboardQuery.currentUserRow
  const statusLabel = currentRow ? getRowStatus(currentRow, leaderboardQuery.rows, 'pressups') : 'QUIET'
  const rivalRow = chase.rowAbove || chase.rowBelow
  const recordCount = profileYearSetup.recordEntries.length
  const profileYearState = !profileYearSetup.profileYear
    ? 'NOT STARTED'
    : profileYearSetup.profileYear.setupStatus === 'claimed'
      ? 'CLAIMED'
      : 'IN PROGRESS'
  const rivalCopy = chase.rowAbove && chase.gapToCatch != null
    ? `${rivalRow?.actorName || 'Unknown'} · ${formatActivityGap(chase.gapToCatch, 'pressups')} to take the spot`
    : chase.rowBelow && chase.gapToDefend != null
      ? `${rivalRow?.actorName || 'Unknown'} · ${formatActivityGap(chase.gapToDefend, 'pressups')} off your back`
      : 'No immediate rival.'

  return (
    <>
      <Card title="Who you're becoming" body="The year is being written.">
        <div className="stack">
          <div className="stat-strip">
            <strong>{profileName}</strong>
            <span>{currentRow ? `#${currentRow.rank} this week` : 'No weekly rank yet'}</span>
          </div>

          {leaderboardQuery.isLoading || profileQuery.isLoading ? (
            <p className="muted">Loading board identity...</p>
          ) : currentRow ? (
            <div className="stack section-gap">
              <div className="stat-strip">
                <span>{formatActivityValue(currentRow.total, 'pressups')} this week</span>
                <span>{recordCount} records claimed</span>
              </div>
              <div className="profile-identity-grid">
                <div className="profile-identity-grid__row">
                  <span className="muted">Board status</span>
                  <strong>{statusLabel}</strong>
                </div>
                <div className="profile-identity-grid__row">
                  <span className="muted">Current rival</span>
                  <strong>{rivalCopy}</strong>
                </div>
                <div className="profile-identity-grid__row">
                  <span className="muted">2026 profile</span>
                  <strong>{profileYearState}</strong>
                </div>
              </div>
              <div className="row-chip-list">
                <span className={`row-chip row-chip--${getStatusTone(statusLabel)}`}>{statusLabel}</span>
                {currentRow.todayTotal > 0 ? <span className="row-chip">ACTIVE TODAY</span> : null}
              </div>
            </div>
          ) : (
            <div className="stack">
              <strong>Not yet on the board.</strong>
              <span>Log press-up activity to make yourself visible.</span>
            </div>
          )}

          <p className="muted">Arena returning. Profiles expanding. The year is being written.</p>
          <button className="button button--ghost" type="button" onClick={() => signOut()}>
            Sign out
          </button>
          <FeedbackActions />
        </div>
      </Card>
      {import.meta.env.DEV ? (
        <details className="build-info">
          <summary>Dev info</summary>
          <div className="stack">
            <p className="muted">Origin: {window.location.origin}</p>
            <p className="muted">Auth target: {`${window.location.origin}/dashboard`}</p>
          </div>
        </details>
      ) : null}
    </>
  )
}

function VaultProfileCard() {
  return (
    <Card title="Vault records" body="Claimed records are visible. Verified records are coming.">
      <div className="stack">
        <p className="muted">The Vault remembers what the Board forgets.</p>
        <Link className="button" to="/vault">
          Enter the Vault
        </Link>
      </div>
    </Card>
  )
}

function ProfileYearEntryCard() {
  const profileYearSetup = useProfileYearSetup(2026)
  const profileYear = profileYearSetup.profileYear
  const recordCount = profileYearSetup.recordEntries.length
  const title = !profileYear
    ? 'Build your 2026 profile'
    : '2026 profile'
  const statusLabel = !profileYear
    ? 'Not started'
    : profileYear.setupStatus === 'claimed'
      ? 'Claimed'
      : 'In progress'

  if (profileYearSetup.isLoading) {
    return (
      <Card title="Build your 2026 profile" body="Claim records. Add yearly totals. Power the Vault.">
        <p className="muted">Loading your year setup.</p>
      </Card>
    )
  }

  if (profileYearSetup.error) {
    return (
      <Card title="Build your 2026 profile" body="Claim records. Add yearly totals. Power the Vault.">
        <p className="muted">Could not load year setup yet.</p>
        <Link className="button" to="/profile/year/2026">
          Build your year
        </Link>
      </Card>
    )
  }

  return (
    <Card title={title} body="Claim your records. Power the Vault.">
      <div className="stack">
        <div className="stat-strip">
          <span>{statusLabel}</span>
          <span>{recordCount} records claimed</span>
        </div>
        <p className="muted">The Board is earned live. The Profile remembers the year.</p>
        <Link className="button" to="/profile/year/2026">
          Build your year
        </Link>
      </div>
    </Card>
  )
}

function FeedbackActions() {
  const { showToast } = useToast()

  function copyTemplate() {
    const template = `Only Gains 2.0 feedback:\nDevice:\nBrowser:\nWhat happened:\nScreenshot attached? Yes/No`

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(template).then(() => {
        showToast({ tone: 'success', message: 'Feedback template copied.' })
      })
    } else {
      const t = document.createElement('textarea')
      t.value = template
      document.body.appendChild(t)
      t.select()
      try {
        document.execCommand('copy')
        showToast({ tone: 'success', message: 'Feedback template copied.' })
      } catch (e) {
        showToast({ tone: 'error', message: 'Could not copy feedback template.' })
      }
      document.body.removeChild(t)
    }
  }

  return (
    <div style={{marginTop: '0.6rem'}}>
      <button className="button button--ghost" type="button" onClick={copyTemplate}>
        Report issue
      </button>
    </div>
  )
}

export default function ProfileScreen() {
  return (
    <div className="screen">
      <AuthGate>
        <div className="stack-lg">
          <ProfileSummary />
          <ProfileYearEntryCard />
          <VaultProfileCard />
          <ProfileBasicsCard />
        </div>
      </AuthGate>
    </div>
  )
}
