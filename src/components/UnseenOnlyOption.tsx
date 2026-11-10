import type { GameMode } from '../types/quiz'
import { useTranslation } from '../i18n'
import { playClick } from '@engine/utils/sound'

interface UnseenOnlyOptionProps {
  mode: GameMode
  checked: boolean
  onChange: (checked: boolean) => void
  /** Questions pas encore découvertes dans la sélection actuelle (thèmes et difficulté compris). */
  unseenCount: number
  /** Nombre de questions que la partie va tirer (mode classique ; les autres modes n'ont pas de nombre fixé). */
  drawnCount: number
}

/** Case « seulement des questions non découvertes » de l'accueil. L'explication n'apparaît qu'une fois la case cochée : en
 * mode classique elle dit ce qui se passe quand la sélection compte moins de questions neuves que la partie n'en tire ;
 * en sans-faute et contre-la-montre, que les questions neuves sont posées d'abord. */
export function UnseenOnlyOption({ mode, checked, onChange, unseenCount, drawnCount }: UnseenOnlyOptionProps) {
  const { t } = useTranslation()
  return <>
    <label className="theme-checkbox timer-toggle">
      <input type="checkbox" checked={checked} aria-describedby={checked ? 'unseen-hint' : undefined} onChange={(event) => { playClick(); onChange(event.target.checked) }} />
      {t('start.unseenToggle', unseenCount)}
    </label>
    {checked && <p className="mode-hint timer-hint" id="unseen-hint" role="status">{t('start.unseenHint', unseenCount, drawnCount, mode)}</p>}
  </>
}
