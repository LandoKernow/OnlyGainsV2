import { useState } from 'react'
import { AuthGate } from '../../features/auth/AuthGate'
import { useAuth } from '../../features/auth/AuthProvider'
import { PressureCard, PressupLeaderboardCard } from '../../features/dashboard/DashboardSections'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useChase } from '../../hooks/useChase'
import { useActivityLeaderboard } from '../../hooks/useActivityLeaderboard'
 

function ChaseContent() {
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
  const chase = useChase(leaderboardQuery.rows, session.user.id, activityType)

  return (
    <div className="stack-lg screen--profile">
      <div className="segmented-toggle">
        <button className={activityType === 'pressups' ? 'pill-button pill-button--active' : 'pill-button'} type="button" onClick={() => setActivityType('pressups')}>Press Ups</button>
        <button className={activityType === 'km' ? 'pill-button pill-button--active' : 'pill-button'} type="button" onClick={() => setActivityType('km')}>KM Ran</button>
      </div>

      <PressureCard chase={chase} isLoading={leaderboardQuery.isLoading} activityType={activityType} variant="chase" />
      <PressupLeaderboardCard
        period={period}
        onPeriodChange={setPeriod}
        rows={leaderboardQuery.rows}
        currentUserRow={leaderboardQuery.currentUserRow}
        isLoading={leaderboardQuery.isLoading}
        error={leaderboardQuery.error}
        compact
        activityType={activityType}
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
