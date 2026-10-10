// ============================================================================
// INACTIVITY CONSEQUENCE SYSTEM — single tuning surface.
// Two-stage escalation: FALLEN (board removal, instantly reversible by one
// qualifying log) then THE WIPE (honours archived to quarantine + deleted;
// user-facing permanent, internally restorable for retentionDays).
//
// SHIPS DISABLED. Nothing marks, warns, or wipes until enabled=true.
// ============================================================================

export const INACTIVITY_CONFIG = {
  // MASTER SWITCH. The sweep, the risen hook, and all client states no-op
  // while false. Flip only after the owner reviews the test decision matrix.
  enabled: false,

  // LAUNCH FAIRNESS EPOCH: no account's clock starts before this London date.
  // Set to the enable date when flipping on, so currently-idle accounts enter
  // the warning sequence from day zero like everyone else — no retroactive
  // executions. (effective last-active = max(last qualifying log, epoch,
  // profile creation day).)
  epochDayKey: '2026-06-14',

  // Day thresholds (days since last qualifying log).
  fallenAtDays: 14,
  wipeAtDays: 21,

  // Warning pushes (day -> stage). Stages are monotonic per cycle; a
  // qualifying log resets the cycle and re-arms all warnings.
  warnings: [
    { day: 10, stage: 1, type: 'INACTIVITY_WARNING' }, // "4 days to fall"
    { day: 13, stage: 2, type: 'INACTIVITY_WARNING' }, // final board warning
    // stage 3 = the FALLEN event itself at day 14
    { day: 20, stage: 4, type: 'INACTIVITY_WARNING' }, // "tomorrow it's ash"
    // stage 5 = the wipe at day 21
  ],

  // Quarantine retention: wiped rows are archived for this long, then
  // hard-deleted by the sweep. Admin restore works inside this window.
  quarantineRetentionDays: 30,
}

// A log QUALIFIES if its value clears the per-discipline floor (same floors
// the FIRST BLOOD system uses — pressups>=1, pullups>=1, km>=0.5, squats>=1),
// measured on London day keys (same day math as streaks). Squats naturally
// start counting the day the Assault goes LIVE and squat rows can exist.
export const INACTIVITY_STAGE_LABELS = {
  1: 'warned_day10',
  2: 'warned_day13',
  3: 'fallen_day14',
  4: 'warned_day20',
  5: 'wiped_day21',
}
