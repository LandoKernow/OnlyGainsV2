import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { ProfileBasicsCard } from '../../features/profile/ProfileBasicsCard'
import { useAuth } from '../../features/auth/AuthProvider'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { useToast } from '../../components/ToastProvider'

function ProfileSummary() {
  const { session, signOut } = useAuth()
  const profileQuery = useCurrentProfile()

  return (
    <>
      <Card title="Who you're becoming" body="Pressure profile.">
        <div className="stack">
          <div className="stat-strip">
            <strong>{profileQuery.data?.name || 'Warrior'}</strong>
            <span>{session?.user?.email}</span>
          </div>
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
