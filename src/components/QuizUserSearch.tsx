import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from '../i18n'
import { QUIZ_ADMIN_ERROR_KEYS, QuizAdminError, searchQuizUsers, type QuizUserMatch } from '../utils/quizAdmins'

/** Délai après la dernière frappe avant de chercher (ms) : une requête par mot tapé, pas par lettre. */
export const SEARCH_DELAY_MS = 300

interface QuizUserSearchProps {
  quizId: string
  /** Le bouton ou l'étiquette à droite de chaque résultat (« Ajouter », « Donner l'accès », le rôle déjà occupé…). */
  renderAction: (match: QuizUserMatch) => ReactNode
  /** Change quand les résultats affichés ne sont plus à jour (une personne vient d'être ajoutée…) : relance la recherche en cours. */
  refreshKey?: number
}

/** Recherche d'un compte par pseudo dans un quiz qu'on administre (`quiz_search_users`, 051). Les comptes ne se retrouvent que
 * par leur pseudo : la liste complète des comptes et leurs adresses email ne sont jamais montrées à un administrateur de quiz. */
export function QuizUserSearch({ quizId, renderAction, refreshKey = 0 }: QuizUserSearchProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<QuizUserMatch[] | null>(null)
  const [error, setError] = useState('')
  const trimmed = query.trim()

  useEffect(() => {
    setError('')
    if (trimmed.length < 2) { setResults(null); return }
    let cancelled = false
    const timer = setTimeout(() => {
      searchQuizUsers(quizId, trimmed)
        .then((found) => { if (!cancelled) setResults(found) })
        .catch((failure) => { if (!cancelled) { setResults(null); setError(t(QUIZ_ADMIN_ERROR_KEYS[failure instanceof QuizAdminError ? failure.failure : 'failed'])) } })
    }, SEARCH_DELAY_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [quizId, trimmed, refreshKey])

  return <div className="quiz-user-search">
    <label>{t('quizAdmin.searchLabel')}
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('quizAdmin.searchPlaceholder')} autoComplete="off" />
    </label>
    <p className="mode-hint">{t('quizAdmin.searchHint')}</p>
    {error && <p className="alert" role="alert">{error}</p>}
    {results && (results.length === 0
      ? <p className="mode-hint" role="status">{t('quizAdmin.searchNone')}</p>
      : <ul className="quiz-user-results">
        {results.map((match) => <li key={match.user_id}>
          <span className="quiz-user-name">{match.avatar} {match.pseudo}</span>
          {renderAction(match)}
        </li>)}
      </ul>)}
  </div>
}
