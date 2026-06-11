// Rotating toast copy by event type. Sharp, competitive, board-pressure tone.
// Pass a seed (value, id, code) to keep the message stable for the same event;
// omit it to rotate randomly. Error toasts never replace console error details.

const TOAST_COPY = {
  log_success_pressups: [
    'BOARD UPDATED.',
    'THE BOARD SAW IT.',
    'LOGGED. NO HIDING NOW.',
    'WORK WRITTEN.',
    'PRESSURE ADDED.',
    'GROUND TAKEN.',
    'YOU MOVED. THEY NOTICED.',
  ],
  log_success_km: [
    'BOARD UPDATED.',
    'DISTANCE BANKED.',
    'THE BOARD MOVED.',
    'ROAD WORK RECORDED.',
    'PRESSURE ADDED.',
    'LEGS PAID RENT.',
    'KM WRITTEN. NO HIDING.',
  ],
  log_error: [
    "DIDN'T LAND. TRY AGAIN.",
    "BOARD DIDN'T TAKE IT.",
    'SAVE FAILED. RUN IT BACK.',
  ],
  board_joined: [
    "YOU'RE ON THE BOARD.",
    'BOARD ENTERED.',
    'NO HIDING NOW.',
    'LOG FIRST. TALK LATER.',
  ],
  board_left: [
    'BOARD LEFT.',
    'YOU WALKED. THE WORK STAYS.',
    'WAR ENDED.',
  ],
  board_created: [
    'BOARD CREATED. NOW FILL IT.',
    'BOARD LIVE. BRING ENEMIES.',
    'NEW BOARD. NEW WAR.',
  ],
  board_switched: [
    'BOARD SWITCHED.',
    'NEW BOARD. SAME RULES.',
    'DIFFERENT WAR. SAME YOU.',
  ],
  delete_success: [
    'ENTRY REMOVED.',
    'RECORD CLEANED.',
    'LOG REMOVED.',
  ],
  delete_error: [
    "COULDN'T REMOVE IT. TRY AGAIN.",
    'THE BOARD HELD ON. RUN IT BACK.',
  ],
  copy_success: [
    'LINK COPIED. SPREAD IT.',
    'COPIED. SEND IT.',
    'LINK READY. RECRUIT.',
  ],
  share_success: [
    'SHARED. PRESSURE SPREADS.',
    'SENT. THE BOARD GROWS.',
    'WORD IS OUT.',
  ],
  generic_error: [
    "DIDN'T LAND. TRY AGAIN.",
    'SOMETHING SLIPPED. RUN IT BACK.',
  ],
}

function getStableIndex(seed, length) {
  let hash = 0

  for (const char of String(seed)) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }

  return Math.abs(hash) % length
}

export function getToastMessage(eventType, seed) {
  const list = TOAST_COPY[eventType] ?? TOAST_COPY.generic_error
  const index = seed != null && seed !== ''
    ? getStableIndex(seed, list.length)
    : Math.floor(Math.random() * list.length)

  return list[index]
}

export function getLogSuccessMessage(activityType, value) {
  const eventType = activityType === 'km' ? 'log_success_km' : 'log_success_pressups'
  return getToastMessage(eventType, value != null ? value : activityType)
}
