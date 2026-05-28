import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBoard,
  fetchBoardInviteDetails,
  fetchBoardInvitePreview,
  fetchMyBoards,
  isBoardFeatureNotReadyError,
  joinBoardByInvite,
  leaveBoard,
} from '../api/boards'
import { useAuth } from '../features/auth/AuthProvider'

export function getMyBoardsQueryKey(userId) {
  return ['boards', 'mine', userId ?? 'guest']
}

export function getBoardInvitePreviewQueryKey(inviteCode) {
  return ['boards', 'invite-preview', String(inviteCode || '').trim()]
}

export function getBoardInviteDetailsQueryKey(boardId) {
  return ['boards', 'invite-details', String(boardId || '').trim()]
}

export function useMyBoards(options = {}) {
  const { session, status } = useAuth()
  const isEnabled = options.enabled ?? (status === 'authenticated' && Boolean(session?.user?.id))

  const query = useQuery({
    queryKey: getMyBoardsQueryKey(session?.user?.id),
    queryFn: fetchMyBoards,
    enabled: isEnabled,
    staleTime: 30_000,
  })

  return {
    ...query,
    boards: query.data?.boards ?? [],
    featureReady: query.data?.featureReady ?? false,
  }
}

export function useBoardInvitePreview(inviteCode) {
  const normalizedInviteCode = String(inviteCode || '').trim()
  const query = useQuery({
    queryKey: getBoardInvitePreviewQueryKey(normalizedInviteCode),
    queryFn: () => fetchBoardInvitePreview(normalizedInviteCode),
    enabled: Boolean(normalizedInviteCode),
    staleTime: 30_000,
  })

  return {
    ...query,
    board: query.data ?? null,
  }
}

export function useBoardInviteDetails(boardId) {
  const normalizedBoardId = String(boardId || '').trim()
  const query = useQuery({
    queryKey: getBoardInviteDetailsQueryKey(normalizedBoardId),
    queryFn: () => fetchBoardInviteDetails(normalizedBoardId),
    enabled: Boolean(normalizedBoardId),
    staleTime: 30_000,
  })

  return {
    ...query,
    board: query.data ?? null,
  }
}

export function useCreateBoard() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBoard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getMyBoardsQueryKey(session?.user?.id) })
    },
  })
}

export function useJoinBoard() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: joinBoardByInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getMyBoardsQueryKey(session?.user?.id) })
    },
  })
}

export function useLeaveBoard() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: leaveBoard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getMyBoardsQueryKey(session?.user?.id) })
    },
  })
}

export function getBoardCreateErrorCopy(error) {
  if (isBoardFeatureNotReadyError(error)) {
    return 'Board tools not ready yet.'
  }

  if (error?.code === '42501') {
    return 'Could not create board.'
  }

  return "Couldn't create board."
}

export function getBoardJoinErrorCopy(error) {
  if (isBoardFeatureNotReadyError(error)) {
    return 'Board invite not ready yet.'
  }

  if (error?.code === '23505') {
    return 'Already on this board.'
  }

  if (error?.code === '42501') {
    return 'Could not join this board.'
  }

  return "Couldn't join this board."
}

export function getBoardLeaveErrorCopy(error) {
  if (isBoardFeatureNotReadyError(error)) {
    return 'Leave board not ready yet.'
  }

  const message = String(error?.message || '').toLowerCase()

  if (message.includes('beta board')) {
    return 'The Beta board stays with you for now.'
  }

  if (message.includes('owner transfer') || message.includes('transfer tools are coming') || message.includes('remove everyone else first')) {
    return 'You hold this board. Transfer tools are coming.'
  }

  return "Couldn't leave board."
}
