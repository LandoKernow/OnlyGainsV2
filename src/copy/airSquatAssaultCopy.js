// ============================================================================
// AIR SQUAT ASSAULT — all event copy. War-voice, leg-dread. Tune here.
// The disciplines have ignored legs. Now the reckoning arrives.
// ============================================================================

export const AIR_SQUAT_ASSAULT_COPY = {
  // Full-screen countdown takeover (once, on app open, TEASE week).
  takeover: {
    eyebrow: 'INCOMING',
    title: 'AIR SQUAT ASSAULT',
    dread: 'YOUR LEGS HAVE BEEN HIDING. NOT FOR LONG.',
    sub: 'THE ARENA OPENS IN',
    cta: 'I HEAR IT',
    footnote: 'PUSH-UPS WON’T SAVE YOU NOW.',
  },

  // Persistent dashboard banner (after the takeover is dismissed).
  banner: {
    eyebrow: 'INCOMING EVENT',
    title: 'AIR SQUAT ASSAULT',
    line: 'The arena opens in',
    dread: 'PUSH. PULL. DISTANCE. You forgot something. Your legs didn’t.',
    reveal: 'WHAT IS THIS?',
  },

  // "WHAT IS THIS" reveal — rules in-voice, not a manual.
  reveal: {
    title: 'AIR SQUAT ASSAULT',
    tagline: 'SEVEN DAYS. ONE DISCIPLINE. NO HIDING.',
    rules: [
      '7 days. Every air squat you log stacks up — cumulative, relentless.',
      'One arena leaderboard. The board’s squats pile into a single collective target — hit it together, or fall short together.',
      'The warrior with the most squats when the clock dies takes the crown. Glory, permanent record, and the right to talk.',
      'Push-ups and distance don’t count here. Legs earned this. Legs pay for it.',
    ],
    closer: 'The strong already know. The rest will find out.',
  },

  // Early opt-in ("ANSWER THE CALL").
  optIn: {
    cta: 'ANSWER THE CALL',
    armed: 'YOU’RE IN. YOU’LL KNOW THE SECOND IT OPENS.',
    armedShort: 'YOU ANSWERED THE CALL',
    failed: 'COULDN’T ARM THE ALERT. TRY AGAIN.',
  },

  // LIVE phase (dark until phase flips).
  live: {
    eyebrow: 'LIVE · AIR SQUAT ASSAULT',
    title: 'THE ARENA IS OPEN',
    closesIn: 'Arena closes in',
    collectiveLabel: 'BOARD ASSAULT',
    championLabel: 'ARENA LEADER',
    empty: 'No squats logged yet. Be the first name on the wall.',
    cry: 'EVERY SQUAT COUNTS. DROP.',
  },

  // ENDED phase.
  ended: {
    eyebrow: 'AIR SQUAT ASSAULT · CLOSED',
    title: 'THE ARENA IS SEALED',
    line: 'The squats are counted. The record stands.',
  },
}
