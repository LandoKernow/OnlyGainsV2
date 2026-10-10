// ============================================================================
// THE STANDARD — single tuning surface.
// The club's minimum: 2,000 press-ups, every warrior, every calendar month
// (London time). The dashboard leads with it, the war card and takeover
// celebrate it. Tune here; nowhere else.
// ============================================================================

export const STANDARD_CONFIG = {
  // Reps every warrior owes the board each month.
  target: 2000,
  activityType: 'pressups',

  // War-card banner lines, fired on the log that crosses each mark (highest
  // first). The target line is also the full-screen takeover.
  milestones: [
    { at: 2000, line: '2,000. THE STANDARD IS MET.' },
    { at: 1500, line: '1,500. THE STANDARD IS IN SIGHT.' },
    { at: 1000, line: 'HALFWAY TO THE STANDARD. DO NOT SLOW DOWN.' },
  ],

  takeover: {
    tagline: 'STANDARD MET. EVERYTHING NOW IS SURPLUS.',
  },

  // How many roll-call rows show before "see all" (your own row always shows).
  rollCallPreview: 6,
}
