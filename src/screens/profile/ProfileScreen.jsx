import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { ProfileBasicsCard } from '../../features/profile/ProfileBasicsCard'
import { useAuth } from '../../features/auth/AuthProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'
import { appEnv } from '../../lib/env'

function ProfileSummary() {
  const { session, signOut } = useAuth()
  const { circleId, timezone } = useBoardMeta()
  const profileQuery = useCurrentProfile()
  const modeLabel = import.meta.env.DEV ? 'dev' : 'deployed'
  const buildLabel = `${appEnv.appName} - ${appEnv.appEnv} - ${modeLabel}`

  return (
    <Card title="Profile shell" body="Board identity is in. Deeper Warrior Profile work stays out until Phase 5.">
      <div className="stack">
        <p className="muted">User: {session?.user?.email}</p>
        <p className="muted">Profile: {profileQuery.data?.name ?? 'Loading...'}</p>
        <p className="muted">Default circle: {circleId || 'Set VITE_DEFAULT_CIRCLE_ID'}</p>
        <p className="muted">Board timezone: {timezone}</p>
        <p className="muted">Build: {buildLabel}</p>
        <p className="muted">Origin: {window.location.origin}</p>
        <p className="muted">Auth return target: {`${window.location.origin}/dashboard`}</p>
        {profileQuery.error ? <p className="muted">{profileQuery.error.message}</p> : null}
        <button className="button button--ghost" type="button" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </Card>
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
