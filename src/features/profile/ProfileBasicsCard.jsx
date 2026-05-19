import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '../../components/Card'
import { useAuth } from '../auth/AuthProvider'
import { upsertMyProfile } from '../../api/profiles'
import { useCurrentProfile } from '../../hooks/useCurrentProfile'

const accents = ['ember', 'copper', 'ash', 'slate']

export function ProfileBasicsCard() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const profileQuery = useCurrentProfile()
  const [form, setForm] = useState({
    name: '',
    avatar: '',
    accent_color: accents[0],
  })

  useEffect(() => {
    if (profileQuery.data) {
      setForm({
        name: profileQuery.data.name ?? '',
        avatar: profileQuery.data.avatar ?? '',
        accent_color: profileQuery.data.accent_color ?? accents[0],
      })
    }
  }, [profileQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertMyProfile({
        id: session.user.id,
        name: form.name,
        avatar: form.avatar,
        accent_color: form.accent_color,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] })
    },
  })

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <Card title="Profile basics" body="Name, avatar, and accent help the board identify you quickly in this beta.">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          saveMutation.mutate()
        }}
      >
        <label className="stack">
          <span>Name</span>
          <input
            className="input"
            type="text"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Warrior name"
            required
          />
        </label>

        <label className="stack">
          <span>Avatar</span>
          <input
            className="input"
            type="text"
            value={form.avatar}
            onChange={(event) => updateField('avatar', event.target.value)}
            placeholder="Avatar key or URL"
          />
        </label>

        <label className="stack">
          <span>Accent</span>
          <select
            className="input"
            value={form.accent_color}
            onChange={(event) => updateField('accent_color', event.target.value)}
          >
            {accents.map((accent) => (
              <option key={accent} value={accent}>
                {accent}
              </option>
            ))}
          </select>
        </label>

        <button className="button" type="submit" disabled={saveMutation.isPending || profileQuery.isLoading}>
          {saveMutation.isPending ? 'Saving...' : 'Save profile'}
        </button>
      </form>

      {profileQuery.isLoading ? <p className="muted">Loading profile...</p> : null}
      {profileQuery.error ? <p className="muted">{profileQuery.error.message}</p> : null}
      {saveMutation.isSuccess ? <p className="muted">Profile saved.</p> : null}
      {saveMutation.error ? <p className="muted">{saveMutation.error.message}</p> : null}
    </Card>
  )
}
