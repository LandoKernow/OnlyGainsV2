import { useState } from 'react'
import { AuthGate } from '../../features/auth/AuthGate'
import { useAuth } from '../../features/auth/AuthProvider'
import { ChaseCard, PressupLeaderboardCard } from '../../features/dashboard/DashboardSections'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useChase } from '../../hooks/useChase'
import { usePressupLeaderboard } from '../../hooks/usePressupLeaderboard'

function ChaseContent() {
  const [period, setPeriod] = useState('weekly')
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const leaderboardQuery = usePressupLeaderboard({
    circleId,
    period,
    currentUserId: session.user.id,
  })
  const chase = useChase(leaderboardQuery.rows, session.user.id)

  return (
    <div className="stack-lg">
      <ChaseCard chase={chase} isLoading={leaderboardQuery.isLoading} period={period} />
      <PressupLeaderboardCard
        period={period}
        onPeriodChange={setPeriod}
        rows={leaderboardQuery.rows}
        currentUserRow={leaderboardQuery.currentUserRow}
        isLoading={leaderboardQuery.isLoading}
        error={leaderboardQuery.error}
        compact
      />
    </div>
  )
}

export default function ChaseScreen() {
  return (
    <div className="screen">
      <AuthGate>
        <ChaseContent />
      </AuthGate>
    </div>
  )
}
