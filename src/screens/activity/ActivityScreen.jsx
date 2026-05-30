import { useState } from 'react'
import { AuthGate } from '../../features/auth/AuthGate'
import { useAuth } from '../../features/auth/AuthProvider'
import { useBoardMeta } from '../../hooks/useBoardMeta'
import { useDeleteSubmission } from '../../hooks/useDeleteSubmission'
import { useRecentSubmissions } from '../../hooks/useRecentSubmissions'
import { RecentActivityCard, RemoveEntryModal } from '../../features/dashboard/DashboardSections'

const BOARD_LIVE_FEED_LIMIT = 20

export default function ActivityScreen() {
  const { session } = useAuth()
  const { circleId } = useBoardMeta()
  const [entryToRemove, setEntryToRemove] = useState(null)
  const recentActivityQuery = useRecentSubmissions(circleId, BOARD_LIVE_FEED_LIMIT, {
    userId: session.user.id,
  })
  const deleteSubmission = useDeleteSubmission({
    circleId,
    userId: session.user.id,
    limit: BOARD_LIVE_FEED_LIMIT,
  })

  function handleConfirmRemove() {
    if (!entryToRemove) {
      return
    }

    deleteSubmission.mutate(
      { submissionId: entryToRemove.legacySubmissionId || entryToRemove.id },
      {
        onSettled: () => {
          setEntryToRemove(null)
        },
      },
    )
  }

  return (
    <div className="screen">
      <AuthGate>
        <div className="stack-lg">
          <RecentActivityCard
            rows={recentActivityQuery.data ?? []}
            isLoading={recentActivityQuery.isLoading}
            error={recentActivityQuery.error}
            currentUserId={session.user.id}
            onRequestRemove={setEntryToRemove}
          />
        </div>
        <RemoveEntryModal
          submission={entryToRemove}
          onConfirm={handleConfirmRemove}
          onCancel={() => {
            if (!deleteSubmission.isPending) {
              setEntryToRemove(null)
            }
          }}
          isDeleting={deleteSubmission.isPending}
        />
      </AuthGate>
    </div>
  )
}
