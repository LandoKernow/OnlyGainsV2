import { Card } from './Card'
import { useAuth } from '../features/auth/AuthProvider'
import { useActivityLeaderboard } from '../hooks/useActivityLeaderboard'
import { useBoardMeta } from '../hooks/useBoardMeta'
import { BOSS_BATTLE_CONFIG } from '../config/bossBattle'
import { formatActivityValue } from '../utils/activity'
import { getLondonPeriodKeys } from '../utils/dates'

function getDaysLeftInWeek(now = new Date()) {
  const { todayKey, weekKey } = getLondonPeriodKeys(now)
  const elapsed = Math.round(
    (new Date(`${todayKey}T12:00:00.000Z`) - new Date(`${weekKey}T12:00:00.000Z`)) / 86_400_000,
  )

  return 7 - elapsed
}

function getCountdownLabel(daysLeft) {
  if (daysLeft <= 1) {
    return 'FINAL DAY'
  }

  return `${daysLeft} DAYS LEFT`
}

function getProgressLine(progress, config) {
  if (progress >= 1) {
    return config.victoryLine
  }

  const band = config.progressLines.find((entry) => progress <= entry.upTo)
  return band?.line ?? config.progressLines[config.progressLines.length - 1].line
}

// The weekly raid. Total board volume vs the boss's health bar — every
// warrior's reps land on the same target. Derived from the weekly
// leaderboard the app already loads; zero extra backend.
export function BossBattleCard() {
  const config = BOSS_BATTLE_CONFIG
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    period: 'weekly',
    currentUserId: session?.user?.id,
    activityType: config.activityType,
  })

  if (!config.enabled || leaderboardQuery.isLoading) {
    return null
  }

  const boardTotal = leaderboardQuery.rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0)
  const progress = Math.min(boardTotal / config.weeklyTarget, 1)
  const remaining = Math.max(config.weeklyTarget - boardTotal, 0)
  const isSlain = progress >= 1
  const daysLeft = getDaysLeftInWeek()
  const yourShare = leaderboardQuery.currentUserRow?.total ?? 0
  const yourCut = boardTotal > 0 ? Math.round((yourShare / boardTotal) * 100) : 0

  return (
    <Card title={config.title} body={config.subtitle} aside={<span className="boss-countdown">{isSlain ? 'WON' : getCountdownLabel(daysLeft)}</span>}>
      <div className="stack boss-battle">
        <div className="boss-health" role="progressbar" aria-valuemin={0} aria-valuemax={config.weeklyTarget} aria-valuenow={Math.min(boardTotal, config.weeklyTarget)}>
          <div
            className={isSlain ? 'boss-health__fill boss-health__fill--slain' : 'boss-health__fill'}
            style={{ width: `${Math.max(progress * 100, 2)}%` }}
          />
        </div>
        <div className="boss-battle__stats">
          <strong>
            {formatActivityValue(boardTotal, config.activityType)} / {formatActivityValue(config.weeklyTarget, config.activityType)}
          </strong>
          <span>{Math.floor(progress * 100)}%</span>
        </div>
        <p className="boss-battle__cry">{getProgressLine(progress, config)}</p>
        {!isSlain ? (
          <p className="muted">
            {formatActivityValue(remaining, config.activityType)} {config.defeatCountdownLine}
          </p>
        ) : null}
        {yourShare > 0 ? (
          <p className="muted">Your damage: {formatActivityValue(yourShare, config.activityType)} ({yourCut}% of the assault).</p>
        ) : (
          <p className="muted">You haven&apos;t landed a hit on it yet. The board noticed.</p>
        )}
      </div>
    </Card>
  )
}
