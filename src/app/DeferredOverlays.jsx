import { AwardCelebrationWatcher } from '../components/AwardCelebrationWatcher'
import { PendingBoardInviteWatcher } from '../components/PendingBoardInviteWatcher'
import { ConscriptionWatcher } from '../components/ConscriptionWatcher'
import { ConscriptionIntro } from '../components/ConscriptionIntro'
import { ReferralWatcher } from '../components/ReferralWatcher'
import { AddToHomeScreenPrompt } from '../components/AddToHomeScreenPrompt'
import { ProfileBuildPrompt } from '../components/ProfileBuildPrompt'
import { WeeklySharePrompt } from '../components/WeeklySharePrompt'

// Background watchers + app-level prompts. None of them paint on first load
// (they wait on auth, queries or timers), so they ship as their own chunk and
// stay off the critical path of the board.
export default function DeferredOverlays() {
  return (
    <>
      <AwardCelebrationWatcher />
      <PendingBoardInviteWatcher />
      <ConscriptionWatcher />
      <ReferralWatcher />
      <ConscriptionIntro />
      <ProfileBuildPrompt />
      <AddToHomeScreenPrompt />
      <WeeklySharePrompt />
    </>
  )
}
