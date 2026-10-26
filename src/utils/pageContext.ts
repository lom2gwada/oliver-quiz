import { routeToHash, type View } from './routes'

/** Pages liées au quiz actif : l'accueil, son historique, son classement et ses parties. Ce sont les seules où l'en-tête
 * présente le quiz (titre, auteur, langue) — ailleurs (Mes quiz, profil, administration) il n'a rien à y faire. */
const QUIZ_PAGES: View[] = ['start', 'history', 'leaderboard', 'quiz', 'streak', 'timed', 'results', 'streakResults', 'timedResults']

export const isQuizPage = (view: View): boolean => QUIZ_PAGES.includes(view)

/** Une partie en cours : y naviguer ailleurs en abandonne la progression, et demande donc confirmation. */
export const isPlayingView = (view: View): boolean => view === 'quiz' || view === 'streak' || view === 'timed'

export interface Crumb {
  label: string
  /** Absent pour la page courante, qui n'est pas un lien. */
  href?: string
}

export interface CrumbLabels {
  home: string
  overview: string
  profile: string
  about: string
  admin: string
  history: string
  leaderboard: string
  /** Titre du quiz actif, pour la page de détail d'un quiz dans l'administration. */
  quizTitle: string
}

/** Fil d'Ariane d'une page : « Accueil › Mes quiz », « Accueil › Administration › Java — Niveau Expert »… Vide pour
 * l'accueil et pour les parties, où l'on ne propose pas de quitter d'un clic. Les pages d'un quiz (historique, classement)
 * n'y répètent pas son titre : le bloc du quiz actif juste en dessous le donne déjà. */
export function breadcrumbFor(view: View, labels: CrumbLabels, quizId: string | null): Crumb[] {
  const home: Crumb = { label: labels.home, href: routeToHash('start', quizId) }
  switch (view) {
    case 'overview': return [home, { label: labels.overview }]
    case 'profile': return [home, { label: labels.profile }]
    case 'about': return [home, { label: labels.about }]
    case 'quizzes': return [home, { label: labels.admin }]
    case 'quizDetail': return [home, { label: labels.admin, href: routeToHash('quizzes', null) }, { label: labels.quizTitle }]
    case 'history': return [home, { label: labels.history }]
    case 'leaderboard': return [home, { label: labels.leaderboard }]
    default: return []
  }
}
