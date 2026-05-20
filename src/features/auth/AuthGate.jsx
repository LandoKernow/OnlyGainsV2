import { useState } from 'react'
import { Card } from '../../components/Card'
import { useAuth } from './AuthProvider'

export function AuthGate({ children }) {
  const {
    status,
    authError,
    signInWithOtp,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
  } = useAuth()
  const [mode, setMode] = useState('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

  function resetMessages() {
    setMessage('')
    setError('')
  }

  function switchMode(nextMode) {
    resetMessages()
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    resetMessages()

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Enter your email.')
      setSubmitting(false)
      return
    }

    if (mode === 'signIn') {
      if (!password) {
        setError('Enter your password.')
        setSubmitting(false)
        return
      }

      const { error: signInError } = await signInWithPassword(trimmedEmail, password)

      if (signInError) {
        setError('Could not sign in. Check your details.')
        setSubmitting(false)
        return
      }

      setMessage('Signed in. Redirecting to the board...')
      setSubmitting(false)
      return
    }

    if (mode === 'signUp') {
      if (!password) {
        setError('Enter your password.')
        setSubmitting(false)
        return
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        setSubmitting(false)
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        setSubmitting(false)
        return
      }

      const { data, error: signUpError } = await signUpWithPassword(trimmedEmail, password)

      if (signUpError) {
        setError('Could not create account. Try again.')
        setSubmitting(false)
        return
      }

      if (data?.session) {
        setMessage('Account created. Redirecting to the board...')
      } else {
        setMessage('Check your email to confirm your account.')
      }

      setSubmitting(false)
      return
    }

    if (mode === 'forgotPassword') {
      const { error: resetError } = await sendPasswordReset(trimmedEmail)

      if (resetError) {
        setError('Could not send reset link. Try again.')
        setSubmitting(false)
        return
      }

      setMessage('Reset link sent. Check your email.')
      setSubmitting(false)
      return
    }

    if (mode === 'magicLink') {
      const { error: magicError } = await signInWithOtp(trimmedEmail)

      if (magicError) {
        setError('Could not send magic link. Try again.')
        setSubmitting(false)
        return
      }

      setMessage('Magic link sent. The board is waiting.')
      setSubmitting(false)
      return
    }
  }

  const title =
    mode === 'signUp'
      ? 'Create account'
      : mode === 'forgotPassword'
      ? 'Reset password'
      : mode === 'magicLink'
      ? 'Use magic link'
      : 'Sign in'

  const body =
    mode === 'signUp'
      ? 'Create an account with email and password.'
      : mode === 'forgotPassword'
      ? 'We’ll send a reset link to your email.'
      : mode === 'magicLink'
      ? 'Send a magic link to sign in without a password.'
      : 'Sign in with your email and password.'

  return (
    <Card title={title} body={body}>
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

        {(mode === 'signIn' || mode === 'signUp') && (
          <label className="stack" style={{ position: 'relative' }}>
            <span>Password</span>
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
            <button
              type="button"
              className="button button--ghost"
              style={{ position: 'absolute', right: 0, top: '2.6rem' }}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </label>
        )}

        {mode === 'signUp' ? (
          <label className="stack">
            <span>Confirm password</span>
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        ) : null}

        <button className="button" type="submit" disabled={submitting}>
          {submitting
            ? mode === 'forgotPassword'
              ? 'Sending...'
              : mode === 'magicLink'
              ? 'Sending...'
              : mode === 'signUp'
              ? 'Creating...'
              : 'Signing in...'
            : mode === 'forgotPassword'
            ? 'Send reset link'
            : mode === 'magicLink'
            ? 'Send magic link'
            : mode === 'signUp'
            ? 'Create account'
            : 'Sign in'}
        </button>
      </form>

      {message ? <p className="muted">{message}</p> : null}
      {error ? <p className="muted">{error}</p> : null}
      {authError ? <p className="muted">{authError}</p> : null}

      <div className="stack" style={{ gap: '0.5rem', marginTop: '1rem' }}>
        {mode === 'signIn' ? (
          <>
            <button type="button" className="button button--ghost" onClick={() => switchMode('forgotPassword')}>
              Forgot password?
            </button>
            <button type="button" className="button button--ghost" onClick={() => switchMode('magicLink')}>
              Use magic link instead
            </button>
            <button type="button" className="button button--ghost" onClick={() => switchMode('signUp')}>
              Create account
            </button>
          </>
        ) : null}

        {mode === 'signUp' ? (
          <button type="button" className="button button--ghost" onClick={() => switchMode('signIn')}>
            Have an account? Sign in
          </button>
        ) : null}

        {mode === 'forgotPassword' ? (
          <>
            <button type="button" className="button button--ghost" onClick={() => switchMode('signIn')}>
              Back to sign in
            </button>
            <button type="button" className="button button--ghost" onClick={() => switchMode('magicLink')}>
              Use magic link instead
            </button>
          </>
        ) : null}

        {mode === 'magicLink' ? (
          <button type="button" className="button button--ghost" onClick={() => switchMode('signIn')}>
            Use password instead
          </button>
        ) : null}
      </div>
    </Card>
  )
}
