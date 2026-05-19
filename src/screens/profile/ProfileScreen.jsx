import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { ProfileBasicsCard } from '../../features/profile/ProfileBasicsCard'
import { useAuth } from '../../features/auth/AuthProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { appEnv } from '../../lib/env'
import { useToast } from '../../components/ToastProvider'

function ProfileSummary() {
  const { session, signOut } = useAuth()
  const profileQuery = useCurrentProfile()
  const modeLabel = import.meta.env.DEV ? 'dev' : 'deployed'
  const buildLabel = `${appEnv.appName} - ${appEnv.appEnv} - ${modeLabel}`

  return (
    <>
      <Card title="Profile" body="Profile basics for your board identity.">
        <div className="stack">
          <p className="muted">User: {session?.user?.email}</p>
          <p className="muted">Name: {profileQuery.data?.name ?? 'Loading...'}</p>
          {profileQuery.data?.avatar ? <p className="muted">Avatar: {profileQuery.data.avatar}</p> : null}
          {profileQuery.data?.accent_color ? <p className="muted">Accent: {profileQuery.data.accent_color}</p> : null}
          <button className="button button--ghost" type="button" onClick={() => signOut()}>
            Sign out
          </button>
          <div className="beta-scope muted" style={{marginTop: '0.5rem'}}>
            <strong>Beta scope</strong>
            <p className="muted" style={{margin: '0.25rem 0 0', fontSize: '0.95rem'}}>
              This beta covers the rebuilt board only: press-up logging, leaderboard, Chase and Recent Activity. Arena, The 1% and full Warrior Profiles will follow.
            </p>
          </div>
          <FeedbackActions />
        </div>
      </Card>
      <details className="build-info">
        <summary>Build info</summary>
        <div className="stack">
          <p className="muted">Build: {buildLabel}</p>
          <p className="muted">Origin: {window.location.origin}</p>
          <p className="muted">Auth return target: {`${window.location.origin}/dashboard`}</p>
        </div>
      </details>
    </>
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
          <ProfileBasicsCard />
        </div>
      </AuthGate>
    </div>
  )
}
