export const GLOBAL_BOARD_ID = 'c769af17-6d63-41aa-8293-a4fd74d586f8'
export const GLOBAL_BOARD_NAME = 'Global Board'
export const BASIC_NON_GLOBAL_BOARD_LIMIT = 2

export function isGlobalBoardId(boardId) {
  return String(boardId || '').trim() === GLOBAL_BOARD_ID
}

export function isGlobalBoard(board) {
  return isGlobalBoardId(board?.id)
}

export function getBoardDisplayName(board) {
  if (isGlobalBoard(board)) {
    return GLOBAL_BOARD_NAME
  }

  return board?.name || 'Untitled board'
}

export function getBoardDisplayTypeLabel(board) {
  if (isGlobalBoard(board)) {
    return 'GLOBAL'
  }

  const normalized = String(board?.boardType || '').trim()

  if (!normalized) {
    return 'Board'
  }

  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function countNonGlobalBoards(boards = []) {
  return boards.filter((board) => !isGlobalBoard(board)).length
}

export function isWithinBasicBoardLimit(boards = []) {
  return countNonGlobalBoards(boards) < BASIC_NON_GLOBAL_BOARD_LIMIT
}
