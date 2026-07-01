import { Card } from './Card'
import { useAuth } from '../features/auth/AuthProvider'
import { useBoardMeta } from '../hooks/useBoardMeta'
import { useActivityLeaderboard } from '../hooks/useActivityLeaderboard'
import { useEventCountdown } from '../hooks/useEventCountdown'
import { formatActivityValue } from '../utils/activity'
import { AIR_SQUAT_ASSAULT_CONFIG, getEndTime, isLive } from '../config/airSquatAssault'
import { AIR_SQUAT_ASSAULT_COPY } from '../copy/airSquatAssaultCopy'

// LIVE arena: the individual cumulative-squat leaderboard + the collective
// board counter pushing toward the target. Built now, DARK until phase flips
// to LIVE (renders nothing otherwise). Reuses the standard leaderboard hook
// against the 'squats' discipline.
export function AirSquatArenaCard() {
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const countdown = useEventCountdown(getEndTime())
  const leaderboardQuery = useActivityLeaderboard({
    circleId,
    period: 'weekly',
    currentUserId: session?.user?.id,
    activityType: AIR_SQUAT_ASSAULT_CONFIG.activityType,
  })

  if (!isLive()) {
    return null
  }

  const copy = AIR_SQUAT_ASSAULT_COPY.live
  const rows = leaderboardQuery.rows.filter((row) => !row.pending)
  const collective = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0)
  const target = AIR_SQUAT_ASSAULT_CONFIG.collectiveTarget
  const progress = Math.min(collective / target, 1)
  const targetFallen = collective >= target
  const you = leaderboardQuery.currentUserRow
  const youEarnedBadge = targetFallen && (you?.total ?? 0) >= AIR_SQUAT_ASSAULT_CONFIG.participationThreshold
  const top = rows.slice(0, 5)

  return (
    <Card
      title={copy.eyebrow}
      body={copy.title}
      aside={<span className="asa-arena__clock">{countdown.days}d {countdown.hours}h left</span>}
      className="asa-arena"
    >
      <div className="stack">
        {/* Collective counter */}
        <div className="asa-collective">
          <div className="asa-collective__head">
            <span className="asa-collective__label">{copy.collectiveLabel}</span>
            <strong className="asa-collective__value">
              {formatActivityValue(collective, 'squats')} / {formatActivityValue(target, 'squats')}
            </strong>
          </div>
          <div className="asa-collective__bar" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(collective, target)}>
            <div
              className={targetFallen ? 'asa-collective__fill asa-collective__fill--won' : 'asa-collective__fill'}
              style={{ width: `${Math.max(progress * 100, 2)}%` }}
            />
          </div>
          <p className="asa-collective__cry">
            {targetFallen ? 'TARGET FALLEN. THE BOARD DID IT.' : `${Math.floor(progress * 100)}% — ${copy.cry}`}
          </p>
          {youEarnedBadge ? <p className="asa-collective__badge">🦵 ASSAULT SURVIVOR — badge earned.</p> : null}
        </div>

        {/* Individual arena leaderboard */}
        {leaderboardQuery.isLoading ? (
          <p className="muted">Sizing up the arena...</p>
        ) : top.length === 0 ? (
          <p className="muted">{copy.empty}</p>
        ) : (
          <ol className="asa-arena__list">
            {top.map((row) => (
              <li key={row.userId} className={row.isCurrentUser ? 'asa-arena__row asa-arena__row--you' : 'asa-arena__row'}>
                <span className="asa-arena__rank">#{row.rank}</span>
                <strong className="asa-arena__name">{row.actorName || 'Warrior'}</strong>
                <span className="asa-arena__total">{formatActivityValue(row.total, 'squats')}</span>
              </li>
            ))}
          </ol>
        )}
        {you && !top.some((row) => row.userId === you.userId) ? (
          <p className="asa-arena__you">You: #{you.rank} · {formatActivityValue(you.total, 'squats')}</p>
        ) : null}
      </div>
    </Card>
  )
}
