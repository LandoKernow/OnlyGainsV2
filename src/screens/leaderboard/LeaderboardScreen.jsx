import { useState } from 'react'
import { AuthGate } from '../../features/auth/AuthGate'
import { useAuth } from '../../features/auth/AuthProvider'
import { HallOfShameCard, PressupLeaderboardCard } from '../../features/dashboard/DashboardSections'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useActivityLeaderboard } from '../../hooks/useActivityLeaderboard'

function LeaderboardContent() {
  const [period, setPeriod] = useState('weekly')
  const [activityType, setActivityType] = useState('pressups')
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    period,
    currentUserId: session.user.id,
    activityType,
    source: 'canonical',
  })

  return (
    <div className="stack-lg screen--profile">
      <div className="segmented-toggle">
        <button className={activityType === 'pressups' ? 'pill-button pill-button--active' : 'pill-button'} type="button" onClick={() => setActivityType('pressups')}>Press Ups</button>
        <button className={activityType === 'km' ? 'pill-button pill-button--active' : 'pill-button'} type="button" onClick={() => setActivityType('km')}>KM Ran</button>
      </div>

      <PressupLeaderboardCard
        period={period}
        onPeriodChange={setPeriod}
        rows={leaderboardQuery.rows}
        currentUserRow={leaderboardQuery.currentUserRow}
        isLoading={leaderboardQuery.isLoading}
        error={leaderboardQuery.error}
        activityType={activityType}
      />

      {!leaderboardQuery.isLoading ? (
        <HallOfShameCard rows={leaderboardQuery.rows} activityType={activityType} />
      ) : null}
    </div>
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
