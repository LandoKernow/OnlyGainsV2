import { useEffect, useState } from 'react'
import { MACHO_TAKEOVER_CONFIG } from '../config/machoTakeover'
import { useEscapeKey } from '../hooks/useEscapeKey'

// The full-screen earned-moment takeover. Macho image slams in, the stat
// lands on top of it, haptics fire, and the whole thing IS the share card —
// one tap renders it to a story-sized PNG.
export function MachoTakeover({ takeover, onShare, onClose }) {
  const [isDismissable, setIsDismissable] = useState(false)

  useEscapeKey(onClose, Boolean(takeover))

  useEffect(() => {
    if (!takeover) {
      setIsDismissable(false)
      return
    }

    // Haptic slam (no-op where unsupported, e.g. iOS Safari).
    try {
      navigator.vibrate?.(MACHO_TAKEOVER_CONFIG.hapticsPattern)
    } catch {
      // Never let a vibration API quirk break the reveal.
    }

    const timer = window.setTimeout(() => {
      setIsDismissable(true)
    }, MACHO_TAKEOVER_CONFIG.dismissDelayMs)

    return () => window.clearTimeout(timer)
  }, [takeover])

  if (!takeover) {
    return null
  }

  const { imageSrc, stat, sub, tagline, warriorName, shareState } = takeover

  return (
    <div className="macho-takeover" role="dialog" aria-modal="true" aria-label="Milestone earned">
      <img className="macho-takeover__image" src={imageSrc} alt="" aria-hidden="true" />
      <div className="macho-takeover__shade" aria-hidden="true" />

      <div className="macho-takeover__brand">ONLY GAINS</div>

      <div className="macho-takeover__slam">
        <strong className="macho-takeover__stat">{stat}</strong>
        {sub ? <span className="macho-takeover__sub">{sub}</span> : null}
        {tagline ? <p className="macho-takeover__tagline">{tagline}</p> : null}
        {warriorName ? <span className="macho-takeover__warrior">{warriorName}</span> : null}
      </div>

      <div className={isDismissable ? 'macho-takeover__actions macho-takeover__actions--ready' : 'macho-takeover__actions'}>
        <button
          className="button macho-takeover__share"
          type="button"
          onClick={onShare}
          disabled={shareState === 'pending'}
        >
          {shareState === 'pending'
            ? 'BUILDING CARD...'
            : shareState === 'shared'
              ? 'SENT.'
              : shareState === 'downloaded'
                ? 'SAVED. POST IT.'
                : shareState === 'copied'
                  ? 'COPIED. POST IT.'
                  : 'SHARE THE PROOF'}
        </button>
        <button className="macho-takeover__dismiss" type="button" onClick={onClose}>
          Back to the board
        </button>
      </div>
    </div>
  )
}
