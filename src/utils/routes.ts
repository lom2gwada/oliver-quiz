/** Pages de l'appli. Chacune a une URL (`#/…`, compatible GitHub Pages : seul le fragment change, le serveur ne voit
 * jamais le chemin) — voir `routeToHash` / `hashToRoute`. */
export type View = 'start' | 'quiz' | 'results' | 'streak' | 'streakResults' | 'timed' | 'timedResults' | 'quizzes' | 'quizDetail' | 'overview' | 'history' | 'leaderboard' | 'profile'

export interface Route {
  view: View
  /** Quiz hébergé concerné par la page, `null` si l'URL n'en désigne pas (le quiz actif est alors conservé). */
  quizId: string | null
}

/** Pages dont l'état n'existe qu'en mémoire : une partie en cours et les écrans de résultat (réponses, questions
 * tirées…). Un rechargement, un favori ou un lien ne peut pas les rouvrir : on retombe alors sur l'accueil du quiz. */
export const EPHEMERAL_VIEWS: View[] = ['quiz', 'streak', 'timed', 'results', 'streakResults', 'timedResults']

export const isEphemeralView = (view: View): boolean => EPHEMERAL_VIEWS.includes(view)

/** Segment final de l'URL d'une page propre à un quiz : `#/quiz/<id>/<segment>`. */
const QUIZ_SEGMENTS: Partial<Record<View, string>> = {
  quiz: 'jouer',
  streak: 'serie',
  timed: 'chrono',
  results: 'resultats',
  streakResults: 'resultats-serie',
  timedResults: 'resultats-chrono',
  history: 'historique',
  leaderboard: 'classement',
}

const VIEW_BY_SEGMENT = new Map<string, View>(Object.entries(QUIZ_SEGMENTS).map(([view, segment]) => [segment as string, view as View]))

const encode = (id: string) => encodeURIComponent(id)

/** L'URL d'une page : `#/` (accueil), `#/quiz/<id>` (accueil d'un quiz), `#/quiz/<id>/historique`, `#/classement`,
 * `#/mes-quiz`, `#/profil`, `#/admin` et `#/admin/<id>`. `quizId` est ignoré pour les pages qui n'en ont pas. */
export function routeToHash(view: View, quizId: string | null): string {
  if (view === 'overview') return '#/mes-quiz'
  if (view === 'profile') return '#/profil'
  if (view === 'quizzes') return '#/admin'
  if (view === 'quizDetail') return quizId ? `#/admin/${encode(quizId)}` : '#/admin'
  if (view === 'start') return quizId ? `#/quiz/${encode(quizId)}` : '#/'
  const segment = QUIZ_SEGMENTS[view]
  return quizId ? `#/quiz/${encode(quizId)}/${segment}` : `#/${segment}`
}

const decode = (part: string): string | null => {
  try { return decodeURIComponent(part) } catch { return null }
}

/** La page désignée par une URL, ou `null` si ce n'en est pas une de l'appli (fragment vide, lien d'invitation ou de
 * récupération Supabase `#access_token=…`, route inconnue) : l'appelant garde alors son comportement par défaut. */
export function hashToRoute(hash: string): Route | null {
  if (!hash.startsWith('#/')) return null
  const parts = hash.slice(1).split('?')[0].split('/').filter(Boolean)
  const [first, second, third] = parts
  if (parts.length === 0) return { view: 'start', quizId: null }
  if (parts.length === 1) {
    if (first === 'mes-quiz') return { view: 'overview', quizId: null }
    if (first === 'profil') return { view: 'profile', quizId: null }
    if (first === 'admin') return { view: 'quizzes', quizId: null }
    const view = VIEW_BY_SEGMENT.get(first)
    return view ? { view, quizId: null } : null
  }
  const id = decode(second)
  if (id === null || id === '') return null
  if (first === 'admin' && parts.length === 2) return { view: 'quizDetail', quizId: id }
  if (first !== 'quiz') return null
  if (parts.length === 2) return { view: 'start', quizId: id }
  const view = parts.length === 3 ? VIEW_BY_SEGMENT.get(third) : undefined
  return view ? { view, quizId: id } : null
}
