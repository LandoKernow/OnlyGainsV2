import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { useBoardMeta } from './useBoardMeta'
import { useVaultAwards } from './useVaultAwards'
import {
  buildAwardCelebrationToast,
  hasSeenAwardCelebration,
  markAwardCelebrationSeen,
  shareAward,
} from '../utils/awardShare'

const CELEBRATABLE_AWARD_TYPES = new Set([
  'weekly_win',
  'monthly_win',
  'double_weekly_win',
  'double_monthly_win',
])

export function useAwardCelebration() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { session, status } = useAuth()
  const { circleId } = useBoardMeta()
  const hasCelebratedThisOpen = useRef(false)
  const userId = session?.user?.id ?? ''
  const awardsQuery = useVaultAwards(circleId, {
    limit: 12,
    userId,
  })

  useEffect(() => {
    if (status !== 'authenticated' || !userId || hasCelebratedThisOpen.current || awardsQuery.isLoading) {
      return
    }

    const nextAward = awardsQuery.awards.find(
      (award) => award.userId === userId && CELEBRATABLE_AWARD_TYPES.has(award.awardType) && !hasSeenAwardCelebration(award.id),
    )

    if (!nextAward) {
      return
    }

    hasCelebratedThisOpen.current = true
    markAwardCelebrationSeen(nextAward.id)

    showToast({
      ...buildAwardCelebrationToast(nextAward),
      primaryActionLabel: 'View in Vault',
      secondaryActionLabel: 'Share',
      onPrimaryAction: () => navigate('/vault'),
      onSecondaryAction: async () => {
        const result = await shareAward(nextAward)
        if (result === 'cancelled') {
          return
        }

        showToast({
          tone: 'success',
          message: result === 'shared' ? 'Award shared.' : 'Share link copied.',
        })
      },
    })
  }, [awardsQuery.awards, awardsQuery.isLoading, navigate, showToast, status, userId])
}
