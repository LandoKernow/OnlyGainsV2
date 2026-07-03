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

function period(event) {
  return p(event).period === 'monthly' ? 'MONTH' : 'WEEK'
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

  // Escalating coronation: single is earned, double is a statement, treble
  // is mythology. Period word ("WEEK"/"MONTH") shifts the weight of each.
  CROWN: (event) => ({
    title: '👑 CROWNED.',
    body: `${(p(event).discipline ?? 'THE BOARD').toUpperCase()} IS YOURS FOR THE ${period(event)}. #1. NOW DEFEND IT.`,
    url: '/profile',
  }),

  DOUBLE_CROWN: (event) => ({
    title: '👑👑 DOUBLE CROWN.',
    body: `${(p(event).discipline ?? 'TWO THRONES').toUpperCase()}. TWO THRONES, ONE ${period(event)}. THE BOARD KNOWS YOUR NAME. ONE MORE FOR THE TREBLE.`,
    url: '/profile',
  }),

  TREBLE: (event) => ({
    title: '⚔️ THE TREBLE. ALL THREE THRONES.',
    body: `YOU HOLD EVERY CROWN ON THE BOARD THIS ${period(event)}. PUSH. PULL. DISTANCE. THE RAREST HONOR IN ONLY GAINS. THEY WILL REMEMBER THIS.`,
    url: '/profile',
  }),

  // Inactivity consequence system — the countdown to the fall and the fire.
  INACTIVITY_WARNING: (event) => {
    const stage = p(event).stage

    if (stage === 1) {
      return {
        title: '⚠️ YOU FALL FROM THE BOARDS IN 4 DAYS.',
        body: 'THE BOARD HAS NOTICED THE SILENCE. ONE LOG SAVES YOU.',
        url: '/dashboard',
      }
    }

    if (stage === 2) {
      return {
        title: '⚠️ FINAL WARNING. TOMORROW YOU FALL.',
        body: 'ONE QUALIFYING LOG BEFORE MIDNIGHT KEEPS YOUR PLACE ON THE BOARDS.',
        url: '/dashboard',
      }
    }

    // stage 4 — the eve of the wipe.
    return {
      title: '🔥 TOMORROW EVERYTHING YOU EARNED IS ASH.',
      body: 'CROWNS. RECORDS. RANK. ALL OF IT BURNS AT MIDNIGHT. ONE LOG SAVES IT ALL.',
      url: '/dashboard',
    }
  },

  FALLEN: () => ({
    title: '💀 YOU HAVE FALLEN FROM THE BOARDS.',
    body: 'FOURTEEN DAYS OF SILENCE. YOUR HONOURS BURN IN 7 DAYS. ONE LOG RAISES YOU.',
    url: '/dashboard',
  }),

  WIPED: () => ({
    title: '🔥 IT IS DONE.',
    body: 'EVERYTHING YOU EARNED IS ASH. THE BOARD REMEMBERS ONLY WARRIORS. START AGAIN — OR DON’T.',
    url: '/dashboard',
  }),

  RISEN: () => ({
    title: '⚔️ RISEN.',
    body: 'YOU CAME BACK. THE BOARDS TAKE YOU IN. DON’T GO QUIET AGAIN.',
    url: '/dashboard',
  }),

  // Copy travels in the payload (source of truth is the event's own copy file),
  // so the same template serves any timed-event launch broadcast.
  EVENT_LAUNCH: (event) => ({
    title: p(event).title || '⚔️ THE ARENA IS OPEN.',
    body: p(event).body || 'GO.',
    url: p(event).url || '/dashboard',
  }),

  RECRUIT_FIRST_BLOOD: (event) => ({
    title: '⚔️ THE ARMY GROWS.',
    body: `${name(event)} — THE WARRIOR YOU DRAGGED IN — JUST DREW FIRST BLOOD. YOUR RANKS ARE SWELLING.`,
    url: '/profile',
  }),

  FIRST_BLOOD: () => ({
    title: '🩸 FIRST BLOOD.',
    body: 'YOU LOGGED YOUR FIRST SET. THE BOARD KNOWS YOUR NAME NOW. THERE IS NO GOING BACK.',
    url: '/dashboard',
  }),

  CROWN_REPORT: (event) => ({
    title: p(event).honor === 'TREBLE' ? '⚔️ A TREBLE HAS BEEN TAKEN.' : '👑👑 DOUBLE CROWN ON THE BOARD.',
    body:
      p(event).honor === 'TREBLE'
        ? `${name(event)} HAS TAKEN THE TREBLE. ALL THREE THRONES. BOW — OR TAKE ONE BACK.`
        : `${name(event)} SEIZED TWO CROWNS THIS ${period(event)}. THE THRONES ARE FALLING. YOUR MOVE.`,
    url: '/leaderboard',
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
