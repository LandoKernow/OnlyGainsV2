import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AuthGate } from '../../features/auth/AuthGate'
import { Card } from '../../components/Card'
import { BattleAlertsPrompt } from '../../components/BattleAlertsPrompt'
import { useMarkAllRead, useNotificationFeed } from '../../hooks/useNotifications'
import { getNotificationCopy } from '../../copy/notificationTemplates'
import { formatRelativeTime } from '../../utils/activity'

const PRIORITY_LABELS = {
  high: 'WAR',
  medium: 'FRONT LINE',
  low: 'CAMP',
}

function AlertRow({ event }) {
  const copy = getNotificationCopy(event)
  const isUnread = !event.read_at

  return (
    <li className={isUnread ? 'alert-row alert-row--unread' : 'alert-row'}>
      <Link className="alert-row__link" to={copy.url}>
        <div className="alert-row__head">
          <span className={`alert-row__priority alert-row__priority--${event.priority}`}>
            {PRIORITY_LABELS[event.priority] ?? 'CAMP'}
          </span>
          <span className="alert-row__time">{formatRelativeTime(event.created_at)}</span>
        </div>
        <strong className="alert-row__title">{copy.title}</strong>
        <span className="alert-row__body">{copy.body}</span>
      </Link>
    </li>
  )
}

function AlertsContent() {
  const feedQuery = useNotificationFeed()
  const markAllRead = useMarkAllRead()
  const events = feedQuery.data ?? []
  const hasUnread = events.some((event) => !event.read_at)

  // Opening the war room reads the reports. Badge clears; bold styling stays
  // for this render so the new ones still hit different.
  useEffect(() => {
    if (hasUnread && !markAllRead.isPending) {
      markAllRead.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread])

  return (
    <div className="stack-lg">
      <Card title="WAR REPORTS" body="What moved while you weren't looking.">
        {feedQuery.isLoading ? <p className="muted">Reading the wire...</p> : null}
        {feedQuery.error ? <p className="muted">Reports unavailable. The war continues. Refresh.</p> : null}
        {!feedQuery.isLoading && events.length === 0 ? (
          <div className="stack">
            <strong>No reports yet.</strong>
            <p className="muted">Quiet board. Change that — log something and make news.</p>
            <Link className="button" to="/dashboard">
              Log the hit
            </Link>
          </div>
        ) : null}
        {events.length > 0 ? (
          <ul className="alert-list">
            {events.map((event) => (
              <AlertRow key={event.id} event={event} />
            ))}
          </ul>
        ) : null}
      </Card>

      <BattleAlertsPrompt trigger="alerts" />
    </div>
  )
}

export default function AlertsScreen() {
  return (
    <div className="screen">
      <AuthGate>
        <AlertsContent />
      </AuthGate>
    </div>
  )
}
