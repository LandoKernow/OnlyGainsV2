import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { getPendingBoardInviteCode } from '../utils/boardInvites'

export function PendingBoardInviteWatcher() {
  const { status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (status !== 'authenticated') {
      return
    }

    const inviteCode = getPendingBoardInviteCode()

    if (!inviteCode || location.pathname.startsWith('/join/')) {
      return
    }

    navigate(`/join/${encodeURIComponent(inviteCode)}`, { replace: true })
  }, [location.pathname, navigate, status])

  return null
}
