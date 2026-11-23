import { useState } from 'react'
import { useTranslation } from '../i18n'
import { inviteUser, UserActionError, USER_ACTION_ERROR_KEYS, type UserActionFailure } from '../utils/adminUserActions'

/** Inviter une adresse : le compte est créé et l'invitation part par email, la personne choisit son mot de passe en cliquant le
 * lien. L'envoi passe par la fonction Edge `admin-users` (seule détentrice de la clé de service). `onInvited` laisse l'appelant
 * recharger sa liste. Le formulaire reste ouvert après un envoi : on invite souvent plusieurs personnes d'affilée. */
export function InviteUserForm({ onInvited }: { onInvited: (email: string) => void | Promise<void> }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<UserActionFailure | null>(null)
  const [notice, setNotice] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const address = email.trim()
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      await inviteUser(address)
      setEmail('')
      setNotice(t('userAccounts.inviteSent', address))
      // L'invitation est partie : si la liste ne se recharge pas, ce n'est pas un échec de l'invitation.
      await Promise.resolve(onInvited(address)).catch(() => {})
    } catch (failure) {
      setError(failure instanceof UserActionError ? failure.failure : 'failed')
    } finally {
      setBusy(false)
    }
  }

  return <form className="profile-form users-invite-form" onSubmit={submit}>
    <h3 className="stats-group-title">{t('userAccounts.inviteTitle')}</h3>
    <p className="mode-hint">{t('userAccounts.inviteHint')}</p>
    <label>{t('userAccounts.emailLabel')}
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="off" maxLength={254} placeholder={t('userAccounts.emailPlaceholder')} />
    </label>
    {error && <p className="alert" role="alert">{t(USER_ACTION_ERROR_KEYS[error])}</p>}
    {notice && <p className="profile-saved" role="status">{notice}</p>}
    <button type="submit" disabled={busy || email.trim() === ''}>{busy ? t('common.loading') : t('userAccounts.inviteSend')}</button>
  </form>
}
