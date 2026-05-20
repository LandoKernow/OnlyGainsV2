import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { useAuth } from '../../features/auth/AuthProvider'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordScreen() {
  const { status, session } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!password) {
      setError('Enter your password.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError('Could not update password. Try again.')
      return
    }

    setMessage('Password updated. Redirecting to the board...')
    setTimeout(() => {
      navigate('/dashboard', { replace: true })
    }, 1000)
  }

  if (status === 'loading') {
    return (
      <Card title="Reset password" body="Checking your reset link.">
        <p className="muted">Please wait while the app finishes auth setup.</p>
      </Card>
    )
  }

  if (!session) {
    return (
      <Card title="Reset password" body="The reset link could not establish a session.">
        <p className="muted">Try signing in or request a new reset link.</p>
      </Card>
    )
  }

  return (
    <Card title="Update password" body="Set a new password for your account.">
      <form className="stack" onSubmit={handleSubmit}>
        <label className="stack">
          <span>New password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label className="stack">
          <span>Confirm password</span>
          <input
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Updating...' : 'Update password'}
        </button>
      </form>

      {message ? <p className="muted">{message}</p> : null}
      {error ? <p className="muted">{error}</p> : null}
    </Card>
  )
}
