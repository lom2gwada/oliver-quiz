import type { Language } from '../i18n/types'
import { useTranslation } from '../i18n'

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'fr', label: 'FR' },
  { value: 'en', label: 'EN' },
]

/** Bascule de la langue de l'interface, affichée dans l'en-tête de toutes les pages. Le choix est celui de
 * l'utilisateur : `onChange` l'enregistre dans son profil (voir `changeLanguage` dans `App.tsx`). Un clic est toujours
 * transmis, même sur la langue déjà affichée : elle peut venir du quiz ouvert et non du profil, et c'est à `onChange`
 * de décider s'il y a quelque chose à enregistrer (voir `shouldSaveLanguage`). */
export function LanguageSwitch({ value, onChange }: { value: Language; onChange: (next: Language) => void }) {
  const { t } = useTranslation()
  return <div className="language-switch" role="group" aria-label={t('nav.languageGroupLabel')}>
    {OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
}
