import { useState } from 'react'
import { Card } from '../../components/Card'
import { useToast } from '../../components/ToastProvider'
import { useAuth } from '../auth/AuthProvider'
import { useNotificationPrefs } from '../../hooks/useNotifications'
import { armPushAlerts, getPermissionState, isPushSupported, needsIosInstall } from '../../utils/pushManager'
import { openAddToHomeScreenPrompt } from '../../utils/community'

const CATEGORY_LABELS = [
  { key: 'chase', label: 'Chase Alerts' },
  { key: 'board', label: 'Board Wars' },
  { key: 'streak', label: 'Streak Warnings' },
  { key: 'milestone', label: 'Milestones' },
]

export function AlertSettingsCard() {
  const { session } = useAuth()
  const { showToast } = useToast()
  const { prefs, isLoading, save } = useNotificationPrefs()
  const [isArming, setIsArming] = useState(false)
  const permission = getPermissionState()
  const iosInstallNeeded = needsIosInstall()
  const canArm = (isPushSupported() && permission === 'default') || iosInstallNeeded

  function update(next) {
    save.mutate(next, {
      onError: () => showToast({ tone: 'error', message: "SETTINGS DIDN'T SAVE. TRY AGAIN." }),
    })
  }

  async function handleArm() {
    if (iosInstallNeeded) {
      openAddToHomeScreenPrompt()
      return
    }

    setIsArming(true)
    const result = await armPushAlerts(session.user.id)
    setIsArming(false)

    if (result === 'granted') {
      showToast({ tone: 'success', message: 'ALERTS ARMED ON THIS DEVICE.' })
    } else if (result === 'denied') {
      showToast({ tone: 'error', message: 'BROWSER SAID NO. CHECK SITE SETTINGS TO RE-ARM.' })
    } else {
      showToast({ tone: 'error', message: "COULDN'T ARM THE ALERTS. TRY AGAIN." })
    }
  }

  return (
    <Card title="BATTLE ALERTS" body="What reaches you, and when.">
      {isLoading ? (
        <p className="muted">Loading alert settings...</p>
      ) : (
        <div className="stack">
          <label className="alert-toggle alert-toggle--master">
            <span>
              <strong>Global mute</strong>
            </span>
            <input
              type="checkbox"
              checked={prefs.globalMute}
              onChange={(event) => update({ ...prefs, globalMute: event.target.checked })}
            />
          </label>

          {CATEGORY_LABELS.map((category) => (
            <label key={category.key} className="alert-toggle">
              <span>
                <strong>{category.label}</strong>
              </span>
              <input
                type="checkbox"
                disabled={prefs.globalMute}
                checked={prefs.categories[category.key] !== false}
                onChange={(event) =>
                  update({
                    ...prefs,
                    categories: { ...prefs.categories, [category.key]: event.target.checked },
                  })
                }
              />
            </label>
          ))}

          {permission === 'granted' ? (
            <p className="muted">Lock-screen alerts: ARMED on this device.</p>
          ) : permission === 'denied' ? (
            <p className="muted">Lock-screen alerts blocked by the browser. Re-enable in site settings.</p>
          ) : canArm ? (
            <button className="button button--ghost" type="button" onClick={handleArm} disabled={isArming}>
              {isArming ? 'ARMING...' : iosInstallNeeded ? 'INSTALL TO UNLOCK LOCK-SCREEN ALERTS' : 'ARM LOCK-SCREEN ALERTS'}
            </button>
          ) : (
            <p className="muted">Lock-screen alerts not supported in this browser. In-app reports still land.</p>
          )}
        </div>
      )}
    </Card>
  )
}
