// Board Live production diagnostics: verbose console tracing for every dev
// build, and in production for the owner's account only. One switch, one
// place — every Board Live trace checks this instead of its own copy.
const BOARD_LIVE_DIAGNOSTICS_USER_ID = '69e4c6a4-9d17-41bd-a3d3-245205e9c9fb'

export function isBoardLiveDiagnosticsUser(userId) {
  if (import.meta.env.DEV) {
    return true
  }

  return String(userId || '').trim() === BOARD_LIVE_DIAGNOSTICS_USER_ID
}
