import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'

const navItems = [
  { to: '/dashboard', label: 'Board' },
  { to: '/leaderboard', label: 'Ranks' },
  { to: '/chase', label: 'Chase' },
  { to: '/vault', label: 'Vault' },
  { to: '/profile', label: 'Profile' },
]

export function AppShell({ children }) {
  const { session, status, authError } = useAuth()
  const location = useLocation()
  const userLabel = session?.user?.email ? session.user.email.split('@')[0] : null
  const isAwardRoute = location.pathname.startsWith('/award/')
  const isJoinRoute = location.pathname.startsWith('/join/')
  const isBoardInviteRoute = /^\/boards\/[^/]+\/invite$/.test(location.pathname)
  const isDashboardRoute = location.pathname === '/dashboard'
  const isLeaderboardRoute = location.pathname.startsWith('/leaderboard')
  const isChaseRoute = location.pathname.startsWith('/chase')
  const isVaultRoute = location.pathname.startsWith('/vault')
  const isProfileRoute = location.pathname.startsWith('/profile')
  const isImmersiveRoute = isAwardRoute || isJoinRoute || isBoardInviteRoute
  const showBottomNav = status === 'authenticated' && !isImmersiveRoute
  const showSessionPill = status !== 'unauthenticated'
  const headerTitle = isDashboardRoute && status === 'authenticated'
    ? 'Who folds first.'
    : isLeaderboardRoute
      ? 'Who owns the board.'
      : isChaseRoute
        ? 'Close the gap.'
        : isVaultRoute
          ? 'Records are remembered.'
          : isProfileRoute
            ? "Who you're becoming."
            : 'Only Gains.'
  const headerClassName = isDashboardRoute && status === 'authenticated'
    ? 'app-header app-header--primary'
    : 'app-header app-header--secondary'

  return (
    <div className={isImmersiveRoute ? 'app-shell app-shell--immersive' : 'app-shell'}>
      {!isImmersiveRoute ? (
        <header className={headerClassName}>
          <div>
            <p className="eyebrow">ONLY GAINS</p>
            <h1>{headerTitle}</h1>
          </div>
          {showSessionPill ? (
            <div className="session-pill" title={session?.user?.email} aria-live="polite">
              {status === 'loading' && 'Session loading'}
              {status === 'authenticated' && userLabel}
              {status === 'setup-error' && (authError || 'Setup error')}
            </div>
          ) : null}
        </header>
      ) : null}

      <main className="app-main">{children}</main>

      {showBottomNav ? (
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
      ) : null}
    </div>
  )
}
