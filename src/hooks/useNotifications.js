import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchNotificationEvents,
  fetchNotificationPrefs,
  fetchUnreadCount,
  markAllEventsRead,
  saveNotificationPrefs,
} from '../api/notifications'
import { NOTIFICATIONS_CONFIG } from '../config/notifications'
import { useAuth } from '../features/auth/AuthProvider'

const FEED_KEY = ['notifications', 'feed']
const UNREAD_KEY = ['notifications', 'unread']

export function useNotificationFeed() {
  const { status } = useAuth()

  return useQuery({
    queryKey: FEED_KEY,
    queryFn: () => fetchNotificationEvents({ limit: 50 }),
    enabled: status === 'authenticated',
    staleTime: 15_000,
  })
}

export function useUnreadCount() {
  const { status } = useAuth()

  const query = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: fetchUnreadCount,
    enabled: status === 'authenticated',
    refetchInterval: NOTIFICATIONS_CONFIG.unreadPollMs,
    staleTime: 30_000,
  })

  return query.data ?? 0
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllEventsRead,
    onSuccess: () => {
      queryClient.setQueryData(UNREAD_KEY, 0)
      queryClient.invalidateQueries({ queryKey: FEED_KEY })
    },
  })
}

export function useNotificationPrefs() {
  const { session, status } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const query = useQuery({
    queryKey: ['notifications', 'prefs', userId],
    queryFn: () => fetchNotificationPrefs(userId),
    enabled: status === 'authenticated' && Boolean(userId),
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: (prefs) => saveNotificationPrefs(userId, prefs),
    onSuccess: (_data, prefs) => {
      queryClient.setQueryData(['notifications', 'prefs', userId], prefs)
    },
  })

  return {
    prefs: query.data ?? { globalMute: false, categories: { ...NOTIFICATIONS_CONFIG.defaultCategories } },
    isLoading: query.isLoading,
    save: saveMutation,
  }
}
