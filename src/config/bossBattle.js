// ============================================================================
// BOSS BATTLE — the community-wide weekly raid. One target, every warrior's
// volume counts, the clock runs out Sunday midnight London.
// Tune everything here. Computed entirely from the weekly leaderboard the
// app already fetches — no backend, no schema.
// ============================================================================

export const BOSS_BATTLE_CONFIG = {
  enabled: true,

  // Which activity feeds the boss and how much the board must stack this week.
  activityType: 'pressups',
  weeklyTarget: 10000,

  title: 'THE 10,000 REP TITAN',
  subtitle: 'The board unites or the board falls.',

  // Progress war cries by completion band (upper bound, line).
  progressLines: [
    { upTo: 0.25, line: 'The Titan is laughing. MAKE IT STOP.' },
    { upTo: 0.5, line: 'First blood drawn. Keep cutting.' },
    { upTo: 0.75, line: 'The Titan is staggering. NO MERCY.' },
    { upTo: 0.999, line: 'IT KNEELS. FINISH IT.' },
  ],

  victoryLine: 'TITAN SLAIN. THE BOARD STANDS.',
  defeatCountdownLine: 'reps short. Every rep counts. EVERY WARRIOR COUNTS.',
}
