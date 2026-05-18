import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'

export default function ActivityScreen() {
  return (
    <div className="screen">
      <AuthGate>
        <div className="stack-lg">
          <Card title="Activity route" body="Logging lives on the Dashboard hot path first.">
            <p className="muted">This route stays lightweight until the board loop is fully proven.</p>
          </Card>
        </div>
      </AuthGate>
    </div>
  )
}
