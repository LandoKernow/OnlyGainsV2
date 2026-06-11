import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { useToast } from '../../components/ToastProvider'
import { AuthGate } from '../../features/auth/AuthGate'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { copyText } from '../../utils/community'
import { getLondonPeriodKeys } from '../../utils/dates'

const GLOBAL_BOARD_ID = 'c769af17-6d63-41aa-8293-a4fd74d586f8'

function buildWeeklySql() {
  return `select *
from public.admin_finalize_period_awards_all(
  '${GLOBAL_BOARD_ID}'::uuid,
  'weekly',
  (date_trunc('week', timezone('Europe/London', now()))::date - 7)
);`
}

function buildMonthlySql() {
  return `select *
from public.admin_finalize_period_awards_all(
  '${GLOBAL_BOARD_ID}'::uuid,
  'monthly',
  (date_trunc('month', timezone('Europe/London', now()))::date - interval '1 month')::date
);`
}

export default function AdminAwardsScreen() {
  const { showToast } = useToast()
  const isAdminQuery = useIsAdmin()
  const { weekKey, monthKey } = getLondonPeriodKeys(new Date())
  const lastCompletedWeek = new Date(`${weekKey}T12:00:00.000Z`)
  lastCompletedWeek.setUTCDate(lastCompletedWeek.getUTCDate() - 7)
  const lastCompletedWeekKey = lastCompletedWeek.toISOString().slice(0, 10)
  const lastCompletedMonth = new Date(`${monthKey}-01T12:00:00.000Z`)
  lastCompletedMonth.setUTCMonth(lastCompletedMonth.getUTCMonth() - 1)
  const lastCompletedMonthKey = lastCompletedMonth.toISOString().slice(0, 10)

  async function handleCopy(sql, label) {
    try {
      await copyText(sql)
      showToast({ tone: 'success', message: `${label} SQL copied.` })
    } catch {
      showToast({ tone: 'error', message: 'Could not copy SQL.' })
    }
  }

  const weeklySql = buildWeeklySql()
  const monthlySql = buildMonthlySql()

  // UI gate only — finalisation itself is enforced server-side. This just
  // keeps the admin room off-limits to regular accounts (no content flash
  // while the admin check loads).
  if (isAdminQuery.isLoading) {
    return (
      <div className="screen">
        <AuthGate>
          <Card title="ADMIN" body="Checking access.">
            <p className="muted">One moment.</p>
          </Card>
        </AuthGate>
      </div>
    )
  }

  if (!isAdminQuery.isAdmin) {
    return (
      <div className="screen">
        <AuthGate>
          <Card title="NOT YOUR ROOM" body="Admin tools live here. Your war is on the board.">
            <Link className="button button--ghost" to="/dashboard">
              Back to the board
            </Link>
          </Card>
        </AuthGate>
      </div>
    )
  }

  return (
    <div className="screen">
      <AuthGate>
        <div className="stack-lg">
          <Card title="ADMIN AWARDS" body="Run this in Supabase SQL editor. Awards are final, not live crowns.">
            <div className="stack">
              <div className="profile-identity-grid">
                <div className="profile-identity-grid__row">
                  <span className="muted">Global Board</span>
                  <strong>{GLOBAL_BOARD_ID}</strong>
                </div>
                <div className="profile-identity-grid__row">
                  <span className="muted">Last completed week</span>
                  <strong>{lastCompletedWeekKey}</strong>
                </div>
                <div className="profile-identity-grid__row">
                  <span className="muted">Last completed month</span>
                  <strong>{lastCompletedMonthKey}</strong>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Finalise last week" body="Press Ups, KM, and Double Crown check.">
            <div className="stack">
              <pre className="admin-sql-block">{weeklySql}</pre>
              <button className="button" type="button" onClick={() => handleCopy(weeklySql, 'Weekly')}>
                Copy weekly SQL
              </button>
            </div>
          </Card>

          <Card title="Finalise last month" body="Press Ups, KM, and Double Crown check.">
            <div className="stack">
              <pre className="admin-sql-block">{monthlySql}</pre>
              <button className="button" type="button" onClick={() => handleCopy(monthlySql, 'Monthly')}>
                Copy monthly SQL
              </button>
            </div>
          </Card>
        </div>
      </AuthGate>
    </div>
  )
}
