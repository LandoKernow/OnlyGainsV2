import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { AwardCelebrationWatcher } from '../components/AwardCelebrationWatcher'
import { ProfileBuildPrompt } from '../components/ProfileBuildPrompt'
import { WeeklySharePrompt } from '../components/WeeklySharePrompt'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ScreenFallback } from '../components/ScreenFallback'

const DashboardScreen = lazy(() => import('../screens/dashboard/DashboardScreen'))
const LeaderboardScreen = lazy(() => import('../screens/leaderboard/LeaderboardScreen'))
const ChaseScreen = lazy(() => import('../screens/chase/ChaseScreen'))
const ActivityScreen = lazy(() => import('../screens/activity/ActivityScreen'))
const AdminAwardsScreen = lazy(() => import('../screens/admin/AdminAwardsScreen'))
const AwardShareScreen = lazy(() => import('../screens/awards/AwardShareScreen'))
const ProfileScreen = lazy(() => import('../screens/profile/ProfileScreen'))
const PublicProfileScreen = lazy(() => import('../screens/profile/PublicProfileScreen'))
const ProfileYearSetupScreen = lazy(() => import('../screens/profile/ProfileYearSetupScreen'))
const PersonalRecordsScreen = lazy(() => import('../screens/profile/PersonalRecordsScreen'))
const VaultScreen = lazy(() => import('../screens/vault/VaultScreen'))
const ResetPasswordScreen = lazy(() => import('../screens/reset/ResetPasswordScreen'))

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
            <Route path="/admin/awards" element={<AdminAwardsScreen />} />
            <Route path="/award/:awardId" element={<AwardShareScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/u/:userId" element={<PublicProfileScreen />} />
            <Route path="/profile/records" element={<PersonalRecordsScreen />} />
            <Route path="/profile/year/:year" element={<ProfileYearSetupScreen />} />
            <Route path="/vault" element={<VaultScreen />} />
            <Route path="/reset-password" element={<ResetPasswordScreen />} />
          </Routes>
          <AwardCelebrationWatcher />
          <ProfileBuildPrompt />
          <WeeklySharePrompt />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  )
}
