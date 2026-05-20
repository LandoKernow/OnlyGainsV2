import { Link } from 'react-router-dom'
import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { ProfileBasicsCard } from '../../features/profile/ProfileBasicsCard'
import { useAuth } from '../../features/auth/AuthProvider'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { useToast } from '../../components/ToastProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useActivityLeaderboard } from '../../hooks/useActivityLeaderboard'
import { useChase } from '../../hooks/useChase'
import { getRowStatus } from '../../utils/status'
import { formatActivityValue } from '../../utils/activity'

function getBoardStatusLabel(status) {
  switch (status) {
    case 'CROWN':
      return 'Holding crown'
    case 'HOLDING':
      return 'Holding lead'
    case 'WAR':
      return 'Locked in war'
    case 'HOT':
      return 'Heat on'
    case 'TOP3':
      return 'In the mix'
    case 'HUNTED':
      return 'Hunted'
    case 'DANGEROUS':
      return 'Dangerous'
    case 'ACTIVE':
      return 'Active'
    default:
      return 'Visible discipline'
  }
}

function ProfileSummary() {
  const { session, signOut } = useAuth()
  const { circleId } = useBoardMeta()
  const profileQuery = useCurrentProfile()
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    currentUserId: session?.user?.id,
    period: 'weekly',
    activityType: 'pressups',
  })
  const chase = useChase(leaderboardQuery.rows, session?.user?.id)
  const profileName = profileQuery.data?.name || session?.user?.email?.split('@')[0] || 'Warrior'
  const currentRow = leaderboardQuery.currentUserRow
  const statusLabel = currentRow ? getBoardStatusLabel(getRowStatus(currentRow, leaderboardQuery.rows)) : null
  const rivalRow = chase.rowAbove || chase.rowBelow

  return (
    <>
      <Card title="Who you're becoming" body={statusLabel || 'Pressure profile.'}>
        <div className="stack">
          <div className="stat-strip">
            <strong>{profileName}</strong>
            <span>{currentRow ? `#${currentRow.rank} this week` : 'No weekly rank yet'}</span>
          </div>

          {leaderboardQuery.isLoading || profileQuery.isLoading ? (
            <p className="muted">Loading board identity…</p>
          ) : currentRow ? (
            <div className="stack section-gap">
              <div className="stat-strip">
                <span>{formatActivityValue(currentRow.total, 'pressups')} this week</span>
                <span>{statusLabel}</span>
              </div>
              <div className="stack">
                {rivalRow ? (
                  <p>
                    {chase.rowAbove ? 'Chasing' : 'Defending against'}{' '}
                    <strong>{rivalRow.actorName || 'the next rival'}</strong>
                  </p>
                ) : (
                  <p className="muted">Stay present. Log reps to build your board identity.</p>
                )}
                {chase.suggestedAction ? <p className="muted">{chase.suggestedAction}</p> : null}
              </div>
            </div>
          ) : (
            <div className="stack">
              <strong>Not yet on the board.</strong>
              <span>Log press-up activity to earn a weekly rank and identity snapshot.</span>
            </div>
          )}

          <p className="muted">Records incoming. Arena returning.</p>
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
    <Card title="Vault records" body="Records incoming. Leave a mark.">
      <div className="stack">
        <p className="muted">See this year’s elite totals and the names that own them.</p>
        <Link className="button" to="/vault">
          Enter the Vault
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
      // Fallback: create textarea
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
          <VaultProfileCard />
          <ProfileBasicsCard />
        </div>
      </AuthGate>
    </div>
  )
}
