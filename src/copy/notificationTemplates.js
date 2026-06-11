// ============================================================================
// NOTIFICATION COPY — every alert is a war report. Tune the voice here.
// Used by the in-app feed AND the lock-screen push (via the Worker).
// Each template gets the event row and returns { title, body, url }.
// payload fields vary by type — see worker/index.js event builders.
// ============================================================================

function name(event) {
  return (event.actor_name || event.actorName || 'A RIVAL').toUpperCase()
}

function p(event) {
  return event.payload ?? {}
}

const TEMPLATES = {
  OVERTAKEN: (event) => ({
    title: 'SPOT TAKEN.',
    body: `${name(event)} JUST TOOK YOUR SPOT. #${p(event).newRank ?? '?'} NOW. YOU GOING TO ALLOW THAT?`,
    url: '/leaderboard',
  }),

  OVERTOOK: (event) => ({
    title: 'TARGET DOWN.',
    body: `${name(event)} IS BEHIND YOU NOW. #${p(event).newRank ?? '?'}. DON'T LOOK BACK.`,
    url: '/leaderboard',
  }),

  CHASE_CLOSING: (event) => ({
    title: 'FOOTSTEPS.',
    body: `${name(event)} IS ${p(event).gapLabel ?? 'CLOSE'} BEHIND YOU. THEY CAN SEE YOUR HEELS.`,
    url: '/chase',
  }),

  CHASE_WON: (event) => ({
    title: 'CAUGHT.',
    body: `YOU RAN DOWN ${name(event)}. FIND THE NEXT ONE.`,
    url: '/chase',
  }),

  CHASE_LOST: (event) => ({
    title: 'OUTRUN.',
    body: `${name(event)} PULLED AWAY. THE GAP IS ${p(event).gapLabel ?? 'GROWING'}. CLOSE IT.`,
    url: '/chase',
  }),

  STREAK_AT_RISK: (event) => ({
    title: 'YOUR STREAK IS DYING.',
    body: `YOUR ${p(event).streakDays ?? '?'}-DAY STREAK DIES AT MIDNIGHT. CLOCK'S TICKING.`,
    url: '/dashboard',
  }),

  MILESTONE: (event) => ({
    title: 'MARK MADE.',
    body: p(event).line || 'A MILESTONE FELL. THE BOARD SAW IT.',
    url: '/profile/records',
  }),

  BOARD_ACTIVITY: (event) => {
    const count = p(event).count ?? 1
    const first = name(event)

    return {
      title: 'THE BOARD IS MOVING.',
      body:
        count > 1
          ? `${first} AND ${count - 1} OTHER${count > 2 ? 'S' : ''} TRAINED IN THE LAST HOUR. YOU'RE THE QUIET ONE.`
          : `${first} JUST PUT IN WORK${p(event).valueLabel ? `: ${p(event).valueLabel}` : ''}. HEARD YOU WERE RESTING.`,
      url: '/dashboard',
    }
  },
}

export function getNotificationCopy(event) {
  const template = TEMPLATES[event.type]

  if (!template) {
    return { title: 'THE BOARD SPOKE.', body: 'Something moved. Go look.', url: '/dashboard' }
  }

  return template(event)
}
