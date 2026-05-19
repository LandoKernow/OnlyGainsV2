import { useState } from 'react'
import { Card } from '../../components/Card'
import { useAuth } from './AuthProvider'

export function AuthGate({ children }) {
  const { status, authError, signInWithOtp } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (status === 'loading') {
    return (
      <Card title="Session loading" body="Checking whether the board already knows you.">
        <p className="muted">The shell stays active while auth settles.</p>
      </Card>
    )
  }

  if (status === 'setup-error') {
    const guidance = import.meta.env.DEV
      ? (authError || 'Check your .env file and restart the app. Copy .env.example to .env when developing locally.')
      : (authError || 'Missing build-time environment variables. When deployed, set VITE_*: use Cloudflare Workers/Wrangler or CI secrets per the README.')

    return (
      <Card title="Setup incomplete" body="Supabase environment values are missing or invalid.">
        <p className="muted">{guidance}</p>
      </Card>
    )
  }

  if (status === 'authenticated') {
    return children
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')

    const { error } = await signInWithOtp(email)

    if (error) {
      setMessage(error.message)
      setSubmitting(false)
      return
    }

    setMessage('Magic link sent. The board is waiting.')
    setSubmitting(false)
  }

  return (
    <Card title="Enter the board" body="Use Supabase email auth to get back into the fight.">
      <form className="stack" onSubmit={handleSubmit}>
        <label className="stack">
          <span>Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
            required
          />
        </label>

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send magic link'}
        </button>
      </form>

      {message ? <p className="muted">{message}</p> : null}
      {authError ? <p className="muted">{authError}</p> : null}
    </Card>
  )
}
