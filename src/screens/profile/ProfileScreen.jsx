import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { ProfileBasicsCard } from '../../features/profile/ProfileBasicsCard'
import { useAuth } from '../../features/auth/AuthProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { appEnv } from '../../lib/env'

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
