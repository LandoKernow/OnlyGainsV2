import { Link } from 'react-router-dom'
import { useUnreadCount } from '../hooks/useNotifications'

// The war-report bell. Lives in the header on every screen; the badge is the
// itch the user has to scratch.
export function NotificationBell() {
  const unread = useUnreadCount()

  return (
    <Link className="notification-bell" to="/alerts" aria-label={unread > 0 ? `${unread} unread alerts` : 'Alerts'}>
      <svg className="notification-bell__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3c-3.3 0-6 2.7-6 6v3.3l-1.7 3.4c-.3.7.1 1.3.8 1.3h13.8c.7 0 1.1-.6.8-1.3L18 12.3V9c0-3.3-2.7-6-6-6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {unread > 0 ? <span className="notification-bell__badge">{unread > 9 ? '9+' : unread}</span> : null}
    </Link>
  )
}
