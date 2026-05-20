import { NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

const navItems = [
  { to: '/dashboard', label: 'Board' },
  { to: '/leaderboard', label: 'Ranks' },
  { to: '/chase', label: 'Chase' },
  { to: '/activity', label: 'Logs' },
  { to: '/profile', label: 'Profile' },
]

export function AppShell({ children }) {
  const { session, status, authError } = useAuth()
  const userLabel = session?.user?.email ? session.user.email.split('@')[0] : null

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">ONLY GAINS</p>
          <h1>Show up. Log it. Get better.</h1>
        </div>
        <div className="session-pill" title={session?.user?.email} aria-live="polite">
          {status === 'loading' && 'Session loading'}
          {status === 'authenticated' && userLabel}
          {status === 'unauthenticated' && 'Signed out'}
          {status === 'setup-error' && (authError || 'Setup error')}
        </div>
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
