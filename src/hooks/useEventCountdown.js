import { useEffect, useState } from 'react'
import { getCountdown } from '../config/airSquatAssault'

// Live countdown to a target ms, ticking once a minute (day/hour/minute
// granularity is all the UI needs — no per-second churn).
export function useEventCountdown(targetMs) {
  const [countdown, setCountdown] = useState(() => getCountdown(targetMs))

  useEffect(() => {
    setCountdown(getCountdown(targetMs))
    const id = window.setInterval(() => setCountdown(getCountdown(targetMs)), 60_000)
    return () => window.clearInterval(id)
  }, [targetMs])

  return countdown
}
