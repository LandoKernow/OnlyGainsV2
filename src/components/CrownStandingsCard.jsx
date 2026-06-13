import { Card } from './Card'
import { useAuth } from '../features/auth/AuthProvider'
import { useBoardMeta } from '../hooks/useBoardMeta'
import { useActivityLeaderboard } from '../hooks/useActivityLeaderboard'
import { CROWNS_CONFIG } from '../config/crowns'

// Live current-period standings: which of the three thrones the user is
// holding right now, and which to chase. Reads the same weekly board totals
// the dashboard already ranks from — no extra detection, no period close.
// Each throne uses the canonical leaderboard (rank #1 = held).
function useThrone(circleId, userId, activityType) {
  const query = useActivityLeaderboard({
    circleId,
    period: 'weekly',
    currentUserId: userId,
    activityType,
  })

  const ranked = query.rows.filter((row) => !row.pending)
  const realContest = ranked.length >= CROWNS_CONFIG.minWarriorsPerDiscipline
  const held = realContest && query.currentUserRow?.rank === 1
  const leader = ranked[0] ?? null
  const gapToTop = query.currentUserRow && leader ? Math.max(leader.total - query.currentUserRow.total, 0) : null

  return {
    isLoading: query.isLoading,
    held,
    realContest,
    leaderName: leader?.actorName ?? null,
    gapToTop,
    activityType,
  }
}

export function CrownStandingsCard() {
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const userId = session?.user?.id

  // One hook per discipline — order matches the config display order.
  const pressups = useThrone(circleId, userId, 'pressups')
  const pullups = useThrone(circleId, userId, 'pullups')
  const km = useThrone(circleId, userId, 'km')
  const thrones = [
    { ...CROWNS_CONFIG.disciplines[0], ...pressups },
    { ...CROWNS_CONFIG.disciplines[1], ...pullups },
    { ...CROWNS_CONFIG.disciplines[2], ...km },
  ]

  if (thrones.every((throne) => throne.isLoading)) {
    return null
  }

  const heldCount = thrones.filter((throne) => throne.held).length
  const tierWord = heldCount >= 3 ? 'TREBLE HELD' : heldCount === 2 ? 'DOUBLE — CHASE THE THIRD' : heldCount === 1 ? 'ONE THRONE HELD' : 'NO THRONES YET'

  return (
    <Card title="CROWN STANDINGS" aside={<span className="crown-standings__count">{heldCount}/3</span>}>
      <p className="crown-standings__verdict">{tierWord}</p>
      <div className="crown-standings">
        {thrones.map((throne) => (
          <div key={throne.key} className={throne.held ? 'throne throne--held' : 'throne'}>
            <span className="throne__crown" aria-hidden="true">{throne.held ? '👑' : '·'}</span>
            <strong className="throne__label">{throne.short}</strong>
            <span className="throne__state">
              {!throne.realContest
                ? 'NO CONTEST'
                : throne.held
                  ? 'HELD'
                  : throne.gapToTop != null
                    ? `−${throne.activityType === 'km' ? throne.gapToTop.toFixed(1) : Math.round(throne.gapToTop)}`
                    : 'CHASE'}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
