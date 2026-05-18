import { useState } from 'react'
import { AuthGate } from '../../features/auth/AuthGate'
import { useAuth } from '../../features/auth/AuthProvider'
import { PressupLeaderboardCard } from '../../features/dashboard/DashboardSections'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { usePressupLeaderboard } from '../../hooks/usePressupLeaderboard'

function LeaderboardContent() {
  const [period, setPeriod] = useState('weekly')
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const leaderboardQuery = usePressupLeaderboard({
    circleId,
    period,
    currentUserId: session.user.id,
  })

  return (
    <PressupLeaderboardCard
      period={period}
      onPeriodChange={setPeriod}
      rows={leaderboardQuery.rows}
      currentUserRow={leaderboardQuery.currentUserRow}
      isLoading={leaderboardQuery.isLoading}
      error={leaderboardQuery.error}
    />
  )
}

export default function LeaderboardScreen() {
  return (
    <div className="screen">
      <AuthGate>
        <LeaderboardContent />
      </AuthGate>
    </div>
  )
}
