import { useTranslation } from '../i18n'
import { isKnownQuizLanguage, normalizeQuizLanguage } from '../utils/quizLanguage'

/** Langue du contenu d'un quiz (`metadata.language`), distincte de celle de l'interface. Champ libre avec
 * suggestions : un code que l'application ne connaît pas (autre que fr/en) n'est jamais refusé, seulement
 * signalé juste en dessous. Vide = langue non précisée. */
export function QuizLanguageField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  const code = normalizeQuizLanguage(value)
  return <>
    <label>{t('admin.quizLanguageLabel')}
      <input type="text" list="quiz-language-suggestions" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t('admin.quizLanguagePlaceholder')} maxLength={12} />
      <datalist id="quiz-language-suggestions"><option value="fr" /><option value="en" /></datalist>
    </label>
    {code !== '' && !isKnownQuizLanguage(code) && <p className="mode-hint" role="status">{t('admin.quizLanguageUnknown', code)}</p>}
  </>
}
