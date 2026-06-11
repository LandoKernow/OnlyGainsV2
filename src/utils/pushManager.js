// Push plumbing: service worker registration, permission state, subscribe/
// unsubscribe, and platform detection for the iOS install funnel.

import { NOTIFICATIONS_CONFIG } from '../config/notifications'
import { removePushSubscription, savePushSubscription } from '../api/notifications'

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// iOS Safari only allows web push for apps launched from the home screen.
export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

// iOS users who haven't installed yet can't subscribe — they get the
// install pitch instead of the permission pitch.
export function needsIosInstall() {
  return isIos() && !isStandalone()
}

export function getPermissionState() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return null
  }

  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

// Full arm sequence: native permission -> SW -> push subscription -> persist.
// Returns 'granted' | 'denied' | 'unsupported' | 'error'.
export async function armPushAlerts(userId) {
  if (!isPushSupported()) {
    return 'unsupported'
  }

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    return 'denied'
  }

  try {
    const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready)
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(NOTIFICATIONS_CONFIG.vapidPublicKey),
      }))

    await savePushSubscription(userId, subscription)
    return 'granted'
  } catch {
    return 'error'
  }
}

export async function disarmPushAlerts() {
  try {
    const registration = await navigator.serviceWorker?.ready

    if (!registration) {
      return
    }

    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await removePushSubscription(subscription.endpoint)
      await subscription.unsubscribe()
    }
  } catch {
    // Best effort — the worker also prunes dead endpoints on failed sends.
  }
}
