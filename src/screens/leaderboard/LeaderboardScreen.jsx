import { useState } from 'react'
import { AuthGate } from '../../features/auth/AuthGate'
import { useAuth } from '../../features/auth/AuthProvider'
import { HallOfShameCard, PressupLeaderboardCard } from '../../features/dashboard/DashboardSections'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useActivityLeaderboard } from '../../hooks/useActivityLeaderboard'
import { BossBattleCard } from '../../components/BossBattleCard'
import { ACTIVITY_META, ACTIVITY_TYPES } from '../../utils/activityTypes'

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
        {ACTIVITY_TYPES.map((type) => (
          <button
            key={type}
            className={activityType === type ? 'pill-button pill-button--active' : 'pill-button'}
            type="button"
            onClick={() => setActivityType(type)}
          >
            {ACTIVITY_META[type].label}
          </button>
        ))}
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

      <BossBattleCard />
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
