import { useEffect, useState } from 'react'
import { useToast } from './ToastProvider'
import { useAuth } from '../features/auth/AuthProvider'
import { NOTIFICATIONS_CONFIG } from '../config/notifications'
import { openAddToHomeScreenPrompt } from '../utils/community'
import {
  armPushAlerts,
  getPermissionState,
  isPushSupported,
  needsIosInstall,
} from '../utils/pushManager'

const DECLINED_KEY_PREFIX = 'only_gains_alerts_prompt_declined_v1'
const ARMED_KEY_PREFIX = 'only_gains_alerts_armed_v1'

function storageKey(prefix, userId) {
  return `${prefix}_${userId}`
}

function readStorage(key) {
  try {
    return globalThis.localStorage?.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Funnel degrades silently in restrictive webviews.
  }
}

// THE PERMISSION FUNNEL. Never fires the native popup cold — our own pitch
// goes first, and only a yes there triggers the browser ask. Declines back
// off for prePromptBackoffDays. iOS Safari (not installed) gets the
// home-screen install pitch instead, since push there needs standalone mode.
export function BattleAlertsPrompt({ trigger = 'alerts' }) {
  const { session, status } = useAuth()
  const { showToast } = useToast()
  const userId = session?.user?.id ?? ''
  const [isVisible, setIsVisible] = useState(false)
  const [isArming, setIsArming] = useState(false)
  const iosInstallNeeded = needsIosInstall()

  useEffect(() => {
    if (status !== 'authenticated' || !userId) {
      setIsVisible(false)
      return
    }

    // Already armed, already granted, or hard-denied at browser level: stay quiet.
    if (readStorage(storageKey(ARMED_KEY_PREFIX, userId)) === 'true') {
      return
    }

    const permission = getPermissionState()

    if (permission === 'granted' || permission === 'denied') {
      return
    }

    if (!isPushSupported() && !iosInstallNeeded) {
      return
    }

    // Backoff after a decline — never nag every session.
    const declinedAt = Number(readStorage(storageKey(DECLINED_KEY_PREFIX, userId))) || 0
    const backoffMs = NOTIFICATIONS_CONFIG.prePromptBackoffDays * 86_400_000

    if (Date.now() - declinedAt < backoffMs) {
      return
    }

    setIsVisible(true)
  }, [iosInstallNeeded, status, userId])

  if (!isVisible) {
    return null
  }

  function handleDecline() {
    writeStorage(storageKey(DECLINED_KEY_PREFIX, userId), String(Date.now()))
    setIsVisible(false)
  }

  async function handleAccept() {
    // iOS pre-install: route to the home-screen pitch; permission comes after.
    if (iosInstallNeeded) {
      setIsVisible(false)
      openAddToHomeScreenPrompt()
      return
    }

    setIsArming(true)

    const result = await armPushAlerts(userId)
    setIsArming(false)
    setIsVisible(false)

    if (result === 'granted') {
      writeStorage(storageKey(ARMED_KEY_PREFIX, userId), 'true')
      showToast({ tone: 'success', message: 'ALERTS ARMED. NOTHING MOVES WITHOUT YOU KNOWING.' })
    } else if (result === 'denied') {
      writeStorage(storageKey(DECLINED_KEY_PREFIX, userId), String(Date.now()))
      showToast({ tone: 'error', message: 'ALERTS REFUSED. FIGHTING BLIND, THEN.' })
    } else {
      showToast({ tone: 'error', message: "COULDN'T ARM THE ALERTS. TRY AGAIN." })
    }
  }

  return (
    <div className="alerts-prompt">
      <p className="alerts-prompt__eyebrow">BATTLE ALERTS</p>
      <strong className="alerts-prompt__title">
        {iosInstallNeeded
          ? 'PUT US ON YOUR HOME SCREEN. UNLOCK BATTLE ALERTS.'
          : "WANT TO KNOW WHEN SOMEONE'S COMING FOR YOUR SPOT?"}
      </strong>
      <p className="alerts-prompt__body">
        {iosInstallNeeded
          ? 'iPhone rule: alerts only reach installed warriors. Add Only Gains to your home screen first.'
          : 'Rivals closing in. Streaks about to die. Thrones overtaken. Straight to your lock screen.'}
      </p>
      <div className="alerts-prompt__actions">
        <button className="button" type="button" onClick={handleAccept} disabled={isArming}>
          {isArming ? 'ARMING...' : iosInstallNeeded ? 'SHOW ME HOW' : 'ARM THE ALERTS'}
        </button>
        <button className="button button--ghost" type="button" onClick={handleDecline} disabled={isArming}>
          FIGHT BLIND
        </button>
      </div>
    </div>
  )
}
