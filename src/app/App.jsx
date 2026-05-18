import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ScreenFallback } from '../components/ScreenFallback'

const DashboardScreen = lazy(() => import('../screens/dashboard/DashboardScreen'))
const LeaderboardScreen = lazy(() => import('../screens/leaderboard/LeaderboardScreen'))
const ChaseScreen = lazy(() => import('../screens/chase/ChaseScreen'))
const ActivityScreen = lazy(() => import('../screens/activity/ActivityScreen'))
const ProfileScreen = lazy(() => import('../screens/profile/ProfileScreen'))

export default function App() {
  return (
    <AppShell>
      <ErrorBoundary fallback={<ScreenFallback title="Screen offline" body="The shell is still alive. Pick another route." />}>
        <Suspense fallback={<ScreenFallback title="Loading" body="Board booting up." />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/leaderboard" element={<LeaderboardScreen />} />
            <Route path="/chase" element={<ChaseScreen />} />
            <Route path="/activity" element={<ActivityScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  )
}
