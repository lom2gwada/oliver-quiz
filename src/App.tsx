import { useEffect, useMemo, useRef, useState } from 'react'
import sampleQuiz from './data/sample-quiz.json'
import { FilterPanel } from './components/FilterPanel'
import { HistoryPage } from './components/HistoryPage'
import { LeaderboardPage } from './components/LeaderboardPage'
import { AppBar } from './components/AppBar'
import { Breadcrumb } from './components/Breadcrumb'
import { CoverageBar } from './components/CoverageBar'
import { SaveStatusNotice } from './components/SaveStatusNotice'
import { LanguageSwitch } from './components/LanguageSwitch'
import { QuizLanguageProvider } from './utils/quizLanguageContext'
import { confirmDialog } from './utils/confirmDialog'
import { abandonGameConfirm, deleteQuestionConfirm, leaveProfileConfirm } from './utils/confirmPresets'
import { ConfirmHost } from './components/ConfirmHost'
import { hashToRoute, isEphemeralView, routeToHash, type View } from './utils/routes'
import { breadcrumbFor, isPlayingView, isQuizPage } from './utils/pageContext'
import { formatNumber, formatPercent } from './utils/format'
import { shouldSaveLanguage } from './utils/languageChoice'
import { storeLanguage, takePendingLanguage } from './utils/languagePreference'
import { isKnownQuizLanguage, normalizeQuizLanguage, quizInterfaceLanguage, quizLanguageLabel } from './utils/quizLanguage'
import { OverviewPage } from './components/OverviewPage'
import { AboutPage } from './components/AboutPage'
import { AppFooter } from './components/AppFooter'
import { ExpandableText } from './components/ExpandableText'
import { FurtherReadingInline } from './components/FurtherReading'
import { ModePicker } from './components/ModePicker'
import { ProfilePage } from './components/ProfilePage'
import { QuizDetailPage } from './components/QuizDetailPage'
import { QuizListPage } from './components/QuizListPage'
import { QuizPage } from './components/QuizPage'
import { ResultPage } from './components/ResultPage'
import { QuizCover } from './components/QuizCover'
import type { QuizMetaExtras } from './components/EditQuizMetaForm'
import { StreakQuizPage, type StreakResult } from './components/StreakQuizPage'
import { StreakResultPage } from './components/StreakResultPage'
import { TimedQuizPage, type TimedResult } from './components/TimedQuizPage'
import { TimedResultPage } from './components/TimedResultPage'
import type { AnswersByQuestion, Difficulty, GameMode, Question, Quiz } from './types/quiz'
import type { Profile } from './types/profile'
import type { HostedQuizSummary } from './types/hostedQuiz'
import { buildAttemptResultPayloads, buildQuestionResultPayloads, buildQuizResultPayload, buildStreakResultPayload, buildTimedResultPayload, deleteQuizHistory, saveQuestionResults, saveQuizResult, saveStreakResult, saveTimedResult } from './utils/quizHistory'
import { fetchProfile, saveProfile } from './utils/profile'
import { fetchStreakTopScore, fetchTimedTopScore, fetchTopScore } from './utils/leaderboard'
import { computeDueQuestions, createQuestionProgressJob, fetchQuestionProgress, selectReviewCards, type ReviewCard } from './utils/leitner'
import { runSaveJobs, type SaveJob, type SaveStatus } from './utils/gameSave'
import { coveragePercentTenths, fetchQuizCoverage, REVIEW_BATCH_SIZE, type QuizCoverage } from './utils/coverage'
import { deleteQuiz, fetchAccessibleQuizzes, fetchAccessibleQuizzesWithRetry, fetchQuizContent, updateQuiz, upsertQuiz } from './utils/hostedQuizzes'
import { applyTheme } from './utils/theme'
import { LanguageProvider, translate } from './i18n'
import type { Language, TranslationKey } from './i18n'
import { parseQuiz, serializeQuiz } from './utils/quizValidation'
import { questionTimeLimit } from './utils/questionTimeLimits'
import { isSoundMuted, playClick, setSoundMuted } from '@engine/utils/sound'
import { pickFreshQuestions } from './utils/pickFreshQuestions'
import { shuffle } from './utils/shuffle'
import { formatDuration } from '@engine/utils/time'


/** Premier affichage seulement, le temps de charger la liste des quiz hébergés — le quiz "Culture générale"
 * vit désormais en base (`020_public_quizzes.sql`, `is_public`) et devient le quiz actif réel dès que ce
 * fetch répond, avec un vrai id (éditable comme n'importe quel quiz hébergé). */
const initialQuiz = parseQuiz(sampleQuiz)
const questionCounts = [5, 10, 20, 30, 50]
/** En minutes ; 0 = « Sans limite » : entraînement, sans fin de partie automatique. */
const durationOptions = [5, 10, 15, 20, 0]

function pickRandomQuestions<T>(questions: T[], count: number): T[] {
  return shuffle(questions).slice(0, Math.min(count, questions.length))
}

/** Dérive un id de thème stable et unique à partir de son libellé (pour la création d'un quiz de zéro). */
function themeIdFrom(label: string, usedIds: Set<string>): string {
  const base = label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'theme'
  let id = base
  let suffix = 2
  while (usedIds.has(id)) { id = `${base}-${suffix}`; suffix += 1 }
  usedIds.add(id)
  return id
}

export default function App({ onLogout }: { onLogout: () => void }) {
  const [quiz, setQuiz] = useState<Quiz>(initialQuiz)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')
  const [gameMode, setGameMode] = useState<GameMode>('classic')
  // Page demandée par l'URL au chargement (rechargement, favori, lien partagé). Une partie en cours ou un écran de
  // résultat ne peut pas être rouvert : on retombe alors sur l'accueil du quiz demandé.
  const initialRoute = useRef(hashToRoute(window.location.hash))
  const [view, setView] = useState<View>(() => (initialRoute.current && !isEphemeralView(initialRoute.current.view) ? initialRoute.current.view : 'start'))
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [publishError, setPublishError] = useState('')
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [publishWarning, setPublishWarning] = useState('')
  const [editError, setEditError] = useState('')
  const [createError, setCreateError] = useState('')
  const [deleteQuizError, setDeleteQuizError] = useState('')
  const [quizLoadError, setQuizLoadError] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [sessionQuestions, setSessionQuestions] = useState<Quiz['questions']>([])
  // Une session de révision Leitner ne porte que sur un sous-ensemble ciblé de questions, pas sur le
  // pool filtré normal : elle ne doit jamais compter comme "sans filtre" pour le classement.
  const [isReplay, setIsReplay] = useState(false)
  /** Pendant et après une révision : la boîte Leitner de chaque question avant la session (par id de question). */
  const [reviewBoxes, setReviewBoxes] = useState<Record<string, number>>({})
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [streakResult, setStreakResult] = useState<StreakResult | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(10)
  const [timedResult, setTimedResult] = useState<TimedResult | null>(null)
  const [timeboxed, setTimeboxed] = useState(false)
  const [muted, setMuted] = useState(isSoundMuted())
  const [profile, setProfile] = useState<Profile | null>(null)
  /** Le pseudo du profil est modifié mais pas enregistré : quitter la page demande confirmation. */
  const profileDirtyRef = useRef(false)
  // Une seule fois par montage, même quand React rejoue les effets en développement (StrictMode) : la seconde
  // exécution relirait un profil pas encore mis à jour par l'enregistrement ci-dessous et écraserait l'état.
  const profileLoadStarted = useRef(false)
  // Vrai quand l'utilisateur a choisi sa langue sur l'écran de connexion : ce choix explicite prime sur la langue du
  // quiz par défaut chargé automatiquement au démarrage (qui n'est pas une action de sa part), une seule fois.
  const keepChosenLanguage = useRef(false)
  useEffect(() => {
    if (profileLoadStarted.current) return
    profileLoadStarted.current = true
    fetchProfile().then((loaded) => {
      // Langue choisie sur l'écran de connexion : report dans le profil, puisque l'utilisateur vient de la choisir.
      const chosenBeforeLogin = takePendingLanguage()
      if (chosenBeforeLogin) { keepChosenLanguage.current = true; setQuizLanguage(null) }
      if (loaded && chosenBeforeLogin && chosenBeforeLogin !== loaded.language) {
        const updated = { ...loaded, language: chosenBeforeLogin }
        setProfile(updated)
        saveProfile({ pseudo: updated.pseudo, avatar: updated.avatar, theme: updated.theme, language: updated.language })
          .catch((error) => { console.error("Impossible d'enregistrer la langue.", error); setProfile(loaded) })
      } else {
        setProfile(loaded)
      }
      if (loaded) storeLanguage(chosenBeforeLogin ?? loaded.language)
    }).catch(() => {})
  }, [])
  useEffect(() => { applyTheme(profile?.theme ?? 'dark') }, [profile?.theme])
  // La langue doit faire re-render tout l'arbre (contrairement au thème, un simple attribut DOM) : elle vit
  // comme un état React fourni via `LanguageProvider`, synchronisé depuis le profil comme le thème l'est.
  const [language, setLanguage] = useState<Language>('fr')
  // Langue imposée par le dernier quiz chargé qui en avait une gérée : elle prime sur celle du profil (qui peut
  // arriver après le quiz), jusqu'à ce que l'utilisateur enregistre une autre langue dans son profil.
  const [quizLanguage, setQuizLanguage] = useState<Language | null>(null)
  useEffect(() => { setLanguage(quizLanguage ?? profile?.language ?? 'fr') }, [quizLanguage, profile?.language])
  /** Choix explicite depuis l'en-tête : prime sur la langue du quiz (jusqu'au prochain chargement d'un quiz
   * dans une langue gérée) et est enregistré dans le profil pour les prochaines visites. */
  const changeLanguage = async (next: Language) => {
    playClick()
    setQuizLanguage(null)
    setLanguage(next)
    storeLanguage(next)
    // On compare à la langue du profil, pas à celle affichée (qui peut venir du quiz) : voir `shouldSaveLanguage`.
    if (!profile || !shouldSaveLanguage(profile.language, next)) return
    const previous = profile
    setProfile({ ...profile, language: next })
    try {
      await saveProfile({ pseudo: profile.pseudo, avatar: profile.avatar, theme: profile.theme, language: next })
    } catch (error) {
      console.error("Impossible d'enregistrer la langue.", error)
      setProfile(previous)
    }
  }
  /** Au chargement d'un quiz : passe l'interface dans sa langue si l'application la gère, sinon ne change rien. */
  const applyQuizLanguage = (loaded: Quiz) => {
    const next = quizInterfaceLanguage(loaded.metadata.language)
    if (!next) return
    setQuizLanguage(next)
    setLanguage(next)
  }
  // `App` rend lui-même `LanguageProvider` plus bas : il ne peut donc pas consommer son propre contexte via
  // `useTranslation()` (un composant ne voit pas le contexte qu'il fournit à ses descendants) — on appelle
  // directement `translate` avec l'état local `language` à la place.
  const t = (key: TranslationKey, ...args: unknown[]) => translate(language, key, ...args)
  const [hostedQuizzes, setHostedQuizzes] = useState<HostedQuizSummary[]>([])
  const [selectedHostedQuizId, setSelectedHostedQuizId] = useState('')
  // Le quiz d'exemple bundlé (`initialQuiz`) ne sert plus que de premier affichage le temps de ce fetch : dès
  // qu'un quiz `is_public` existe en base, il devient le quiz actif réel (avec un vrai id, éditable comme
  // n'importe quel quiz hébergé) — sauf si l'utilisateur a déjà sélectionné autre chose entre-temps.
  //
  // Un échec ne doit jamais passer inaperçu : le quiz embarqué est visuellement identique au quiz d'exemple, et
  // jouer dessus enregistrerait la partie sans `quiz_id` ni progression de révision. Le chargement est donc
  // repris automatiquement, signalé s'il échoue, rejoué au retour du réseau ou de l'onglet, et le démarrage
  // d'une partie reste bloqué tant qu'aucun quiz hébergé n'est chargé.
  const [quizListState, setQuizListState] = useState<'loading' | 'ready' | 'error'>('loading')
  const selectedIdRef = useRef('')
  selectedIdRef.current = selectedHostedQuizId
  // Met l'identifiant à jour immédiatement (et pas seulement au prochain rendu) : la navigation qui suit une sélection
  // construit son URL avec cet identifiant.
  const selectId = (id: string) => { selectedIdRef.current = id; setSelectedHostedQuizId(id) }
  const hostedQuizzesRef = useRef<HostedQuizSummary[]>([])
  hostedQuizzesRef.current = hostedQuizzes
  const loadQuizzes = () => {
    setQuizListState('loading')
    fetchAccessibleQuizzesWithRetry().then((quizzes) => {
      setHostedQuizzes(quizzes)
      setQuizListState('ready')
      if (!selectedIdRef.current) {
        // Un lien vers un quiz précis l'ouvre directement ; s'il est inconnu ou inaccessible, on retombe sur le quiz par défaut.
        const requestedId = initialRoute.current?.quizId ?? null
        const chosen = (requestedId && quizzes.find((hosted) => hosted.id === requestedId)) || quizzes.find((hosted) => hosted.is_public)
        if (chosen) {
          selectHostedQuiz(chosen.id, keepChosenLanguage.current)
          keepChosenLanguage.current = false
        }
        if (requestedId && chosen?.id !== requestedId) window.history.replaceState({ view: viewRef.current }, '', urlForView(viewRef.current))
      }
    }).catch((error) => {
      console.error('Impossible de charger la liste des quiz.', error)
      setQuizListState('error')
    })
  }
  useEffect(() => { loadQuizzes() }, [])
  useEffect(() => {
    if (quizListState !== 'error') return
    const retry = () => { if (document.visibilityState === 'visible') loadQuizzes() }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', retry) }
  }, [quizListState])
  // Reflète le mode sélectionné sur la page d'accueil (le sélecteur de mode juste en dessous) plutôt que
  // toujours le classique — sinon le record affiché n'a aucun rapport avec le mode que l'utilisateur s'apprête
  // à lancer. Un seul badge affiché à la fois : `avatar`/`pseudo`/`scoreText` déjà mis en forme pour rester
  // agnostique du mode d'origine (classement classique, sans-faute ou contre-la-montre).
  const [topScore, setTopScore] = useState<{ avatar: string; pseudo: string; mode: GameMode; value: number | null; victory: boolean } | null>(null)
  useEffect(() => {
    if (view !== 'start') return
    setTopScore(null)
    const title = quiz.metadata.title
    const quizId = selectedHostedQuizId || null
    if (gameMode === 'classic') {
      fetchTopScore(title, quizId).then((row) => setTopScore(row && { avatar: row.avatar, pseudo: row.pseudo, mode: 'classic', value: row.correct_count, victory: false })).catch(() => setTopScore(null))
    } else if (gameMode === 'streak') {
      fetchStreakTopScore(title, quizId).then((row) => setTopScore(row && { avatar: row.avatar, pseudo: row.pseudo, mode: 'streak', value: row.best_streak, victory: row.victory })).catch(() => setTopScore(null))
    } else {
      fetchTimedTopScore(title, quizId).then((row) => setTopScore(row && { avatar: row.avatar, pseudo: row.pseudo, mode: 'timed', value: row.pace_per_minute, victory: false })).catch(() => setTopScore(null))
    }
  }, [view, gameMode, quiz.metadata.title, selectedHostedQuizId])
  const [leaderboardBack, setLeaderboardBack] = useState<View>('start')
  const [leaderboardMode, setLeaderboardMode] = useState<GameMode>('classic')
  const [leaderboardFocus, setLeaderboardFocus] = useState<{ key: string; label: string } | null>(null)
  const viewLeaderboard = (from: View, mode: GameMode = 'classic', focus: { key: string; label: string } | null = null) => { setLeaderboardBack(from); setLeaderboardMode(mode); setLeaderboardFocus(focus); navigate('leaderboard') }
  // Progression du quiz actif, affichée sur l'accueil : rechargée à chaque retour sur l'accueil (une partie vient
  // peut-être de la faire avancer). Purement informative — un échec masque simplement la barre.
  const [activeCoverage, setActiveCoverage] = useState<QuizCoverage | null>(null)
  useEffect(() => {
    if (view !== 'start' || !selectedHostedQuizId) return
    let cancelled = false
    fetchQuizCoverage().then((rows) => { if (!cancelled) setActiveCoverage(rows.find((row) => row.quiz_id === selectedHostedQuizId) ?? null) }).catch(() => { if (!cancelled) setActiveCoverage(null) })
    return () => { cancelled = true }
  }, [view, selectedHostedQuizId])
  const [overviewBack, setOverviewBack] = useState<View>('start')
  const viewOverview = (from: View) => { setOverviewBack(from); navigate('overview') }
  const [historyBack, setHistoryBack] = useState<View>('start')
  const viewHistory = (from: View) => { setHistoryBack(from); navigate('history') }

  // Chaque page a son URL (`#/…`, voir utils/routes.ts) : un rechargement la réaffiche, un favori ou un lien y mène, et
  // le back/swipe-back du navigateur se comporte comme le bouton « Retour » de l'appli plutôt que de la quitter.
  // Chaque navigation interne pousse une entrée d'historique, et on resynchronise `view` sur popstate à partir de l'URL.
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  const sessionQuestionsRef = useRef(sessionQuestions)
  sessionQuestionsRef.current = sessionQuestions
  const streakResultRef = useRef(streakResult)
  streakResultRef.current = streakResult
  const timedResultRef = useRef(timedResult)
  timedResultRef.current = timedResult
  // Le gestionnaire de popstate est posé une seule fois : il lit ces références pour toujours utiliser les versions à jour.
  const selectHostedQuizRef = useRef<(id: string) => Promise<void>>(async () => {})
  const tRef = useRef(t)
  tRef.current = t
  const urlForView = (target: View, quizId: string | null = selectedIdRef.current || null) => `${window.location.pathname}${window.location.search}${routeToHash(target, quizId)}`
  useEffect(() => {
    // Une URL de partie ou de résultats, qu'on ne peut pas rouvrir, est ramenée à l'accueil du quiz demandé.
    const route = initialRoute.current
    const restoredView: View = route && !isEphemeralView(route.view) ? route.view : 'start'
    window.history.replaceState({ view: restoredView }, '', route && isEphemeralView(route.view) ? urlForView('start', route.quizId) : undefined)
    const onPopState = () => {
      const target = hashToRoute(window.location.hash)
      let nextView: View = target?.view ?? 'start'
      // Une partie ou un écran de résultat n'est rouvrable que si ses données sont encore en mémoire (retour de
      // l'historique vers les résultats qu'on venait de voir, par exemple).
      if (isEphemeralView(nextView) && nextView !== viewRef.current) {
        const inMemory = (nextView === 'results' && sessionQuestionsRef.current.length > 0)
          || (nextView === 'streakResults' && streakResultRef.current !== null)
          || (nextView === 'timedResults' && timedResultRef.current !== null)
        if (!inMemory) {
          nextView = 'start'
          window.history.replaceState({ view: 'start' }, '', urlForView('start', target?.quizId ?? (selectedIdRef.current || null)))
        }
      }
      // Précédent / Suivant d'une page d'un autre quiz : le quiz de l'URL redevient le quiz actif.
      const syncQuiz = () => {
        if (!target?.quizId || isEphemeralView(nextView) || target.quizId === selectedIdRef.current) return
        if (hostedQuizzesRef.current.some((hosted) => hosted.id === target.quizId)) selectHostedQuizRef.current(target.quizId)
      }
      if (viewRef.current === 'profile' && nextView !== 'profile' && profileDirtyRef.current) {
        confirmDialog(leaveProfileConfirm(tRef.current)).then((leave) => {
          if (!leave) { window.history.pushState({ view: 'profile' }, '', urlForView('profile')); return }
          setView(nextView)
          syncQuiz()
        })
        return
      }
      if ((viewRef.current === 'quiz' || viewRef.current === 'streak' || viewRef.current === 'timed') && nextView !== viewRef.current) {
        const playingView = viewRef.current
        confirmDialog(abandonGameConfirm(tRef.current, tRef.current('start.confirmAbandon'))).then((leave) => {
          if (!leave) { window.history.pushState({ view: playingView }, '', urlForView(playingView)); return }
          setAnswers({}); setSessionQuestions([]); setElapsedSeconds(0)
          setView(nextView)
          syncQuiz()
        })
        return
      }
      setView(nextView)
      syncQuiz()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const navigate = (next: View) => { setView(next); window.history.pushState({ view: next }, '', urlForView(next)) }
  // Remplace l'entrée d'historique courante plutôt que d'en empiler une nouvelle : utilisé pour quitter
  // "quiz" (fin de partie ou abandon), qui n'est pas un état vers lequel on veut pouvoir revenir en arrière.
  const replace = (next: View) => { setView(next); window.history.replaceState({ view: next }, '', urlForView(next)) }
  // Les pages d'administration ne sont pas pour les autres comptes (leur bouton est déjà masqué) : une URL tapée à la main
  // les ramène à l'accueil dès que le profil est chargé.
  useEffect(() => { if (profile && !profile.isAdmin && (view === 'quizzes' || view === 'quizDetail')) replace('start') }, [profile, view])
  // Navigation depuis la barre supérieure, présente sur toutes les pages : quitter une partie en cours en abandonne la
  // progression, comme le bouton « Annuler » et le retour du navigateur, et demande donc confirmation.
  const confirmLeaveProfile = async () => !profileDirtyRef.current || await confirmDialog(leaveProfileConfirm(t))
  const goTo = async (next: View) => {
    if (viewRef.current === next) return
    playClick()
    if (viewRef.current === 'profile' && !(await confirmLeaveProfile())) return
    if (isPlayingView(viewRef.current)) {
      if (!(await confirmDialog(abandonGameConfirm(t, t('start.confirmAbandon'))))) return
      setAnswers({}); setSessionQuestions([]); setElapsedSeconds(0)
    }
    navigate(next)
  }
  const filteredQuestions = useMemo(() => quiz.questions.filter((question) =>
    (!selectedThemes.length || selectedThemes.includes(question.category)) && (!difficulty || question.difficulty === difficulty)), [quiz, selectedThemes, difficulty])
  // Seules les parties jouées sans filtre comptent pour le classement : sinon un thème/une difficulté
  // choisie exprès rendrait les scores/streaks/rythmes incomparables entre joueurs.
  const isUnfiltered = selectedThemes.length === 0 && difficulty === ''
  // Les questions effectivement tirées ne sont connues qu'au lancement (tirage aléatoire) : l'estimation
  // s'appuie donc sur la moyenne des temps limites (propres à chaque question, ou barème par défaut par
  // type/difficulté) du pool filtré, mise à l'échelle du nombre de questions qui seront réellement jouées.
  const timedEstimateSeconds = useMemo(() => {
    if (!filteredQuestions.length) return 0
    const averageLimit = filteredQuestions.reduce((sum, question) => sum + questionTimeLimit(question), 0) / filteredQuestions.length
    return Math.round(averageLimit * Math.min(questionCount, filteredQuestions.length))
  }, [filteredQuestions, questionCount])

  // Sans quiz hébergé identifié (liste non chargée, ou contenu en échec), démarrer jouerait le quiz embarqué.
  // Exception : aucun quiz hébergé accessible du tout, où le quiz embarqué est alors la seule option.
  const quizReady = quizListState === 'ready' && !quizLoadError && (selectedHostedQuizId !== '' || hostedQuizzes.length === 0)
  const retryQuizLoad = () => (quizListState === 'error' ? loadQuizzes() : selectHostedQuiz(selectedHostedQuizId))

  const toggleTheme = (themeId: string) => setSelectedThemes((previous) =>
    previous.includes(themeId) ? previous.filter((id) => id !== themeId) : [...previous, themeId])

  const selectHostedQuiz = async (id: string, keepLanguage = false) => {
    selectId(id)
    if (!id) { setQuiz(initialQuiz); setSelectedThemes([]); setDifficulty(''); setSessionQuestions([]); setQuizLoadError(''); return }
    try {
      const loaded = parseQuiz(await fetchQuizContent(id))
      setQuiz(loaded)
      if (!keepLanguage) applyQuizLanguage(loaded)
      setSelectedThemes([]); setDifficulty(''); setSessionQuestions([]); setQuizLoadError('')
    } catch (error) {
      setQuizLoadError(error instanceof Error ? error.message : t('admin.errorLoadQuiz'))
    }
  }

  /** Depuis la liste des quiz hébergés : sélectionne le quiz cliqué comme quiz actif puis ouvre sa page de détail. */
  const openQuizDetail = async (id: string) => {
    await selectHostedQuiz(id)
    navigate('quizDetail')
  }

  /** Admin uniquement : crée un quiz vide de zéro (titre/auteur/description + thèmes de départ, aucune question).
   * Bloque si le titre existe déjà (l'upsert par titre écraserait sinon silencieusement un quiz existant).
   * Le nouveau quiz devient le quiz actif, prêt à recevoir des questions via "➕ Ajouter une question". */
  const createQuiz = async (title: string, author: string, description: string, themeLabels: string[], quizLanguage: string) => {
    setCreateError('')
    if (hostedQuizzes.some((existing) => existing.title === title)) {
      setCreateError(t('admin.errorDuplicateTitle'))
      throw new Error('duplicate title')
    }
    try {
      const usedIds = new Set<string>()
      const themes = themeLabels.map((label) => ({ id: themeIdFrom(label, usedIds), label }))
      const newQuiz = parseQuiz({
        version: '1.0',
        metadata: { title, author, createdAt: new Date().toISOString(), description: description || undefined, language: normalizeQuizLanguage(quizLanguage) || undefined },
        themes,
        questions: [],
      })
      const id = await upsertQuiz(newQuiz.metadata.title, serializeQuiz(newQuiz))
      setQuiz(newQuiz)
      applyQuizLanguage(newQuiz)
      selectId(id)
      setSelectedThemes([]); setDifficulty(''); setSessionQuestions([])
      fetchAccessibleQuizzes().then(setHostedQuizzes).catch(() => {})
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t('admin.errorCreateQuiz'))
      throw error
    }
  }

  /** Depuis la liste des quiz : créer un quiz navigue directement vers sa page de détail (prêt à ajouter des
   * questions), comme aujourd'hui. En cas d'échec (ex. titre dupliqué), `createQuiz` rejette : l'erreur remonte
   * telle quelle pour que `CreateQuizForm` garde son propre `catch` (formulaire laissé ouvert) — pas de navigation. */
  const createQuizAndOpen = async (title: string, author: string, description: string, themeLabels: string[], quizLanguage: string) => {
    await createQuiz(title, author, description, themeLabels, quizLanguage)
    navigate('quizDetail')
  }

  /** Admin uniquement : publie un quiz (crée ou met à jour par titre) — n'accorde jamais d'accès automatiquement. */
  const publishQuiz = async (file?: File) => {
    if (!file) return
    setPublishSuccess(false)
    setPublishWarning('')
    try {
      let content: unknown
      try { content = JSON.parse(await file.text()) } catch { throw new Error(t('admin.errorInvalidJson')) }
      const parsed = parseQuiz(content)
      await upsertQuiz(parsed.metadata.title, content)
      setPublishError('')
      setPublishSuccess(true)
      const importedLanguage = normalizeQuizLanguage(parsed.metadata.language ?? '')
      if (importedLanguage && !isKnownQuizLanguage(importedLanguage)) setPublishWarning(t('admin.quizLanguageUnknown', importedLanguage))
      fetchAccessibleQuizzes().then(setHostedQuizzes).catch(() => {})
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : t('admin.errorInvalidJson'))
    }
  }

  /** Revalide l'ensemble du quiz avec la liste de questions donnée puis republie sous le même titre
   * (mêmes accès `quiz_access` conservés, cf. upsert par titre). Partagé par édition/ajout/suppression. */
  const republishQuestions = async (questions: Question[]) => {
    const updatedQuiz = parseQuiz({ ...quiz, questions })
    await upsertQuiz(updatedQuiz.metadata.title, serializeQuiz(updatedQuiz))
    setQuiz(updatedQuiz)
    fetchAccessibleQuizzes().then(setHostedQuizzes).catch(() => {})
  }

  /** Admin uniquement, sur un quiz hébergé actif : remplace une question. Rejette en cas d'échec pour laisser le formulaire ouvert. */
  const saveQuestion = async (updated: Question) => {
    setEditError('')
    try {
      await republishQuestions(quiz.questions.map((existing) => (existing.id === updated.id ? updated : existing)))
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('admin.errorSaveQuestion'))
      throw error
    }
  }

  /** Admin uniquement, sur un quiz hébergé actif : ajoute une nouvelle question. Rejette en cas d'échec pour laisser le formulaire ouvert. */
  const addQuestion = async (created: Question) => {
    setEditError('')
    try {
      await republishQuestions([...quiz.questions, created])
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('admin.errorAddQuestion'))
      throw error
    }
  }

  /** Admin uniquement, sur un quiz hébergé actif : supprime définitivement une question, après confirmation. */
  const deleteQuestion = async (id: string) => {
    if (!(await confirmDialog(deleteQuestionConfirm(t)))) return
    setEditError('')
    try {
      await republishQuestions(quiz.questions.filter((question) => question.id !== id))
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('admin.errorDeleteQuestion'))
    }
  }

  /** Admin uniquement, sur un quiz hébergé actif : ajoute un thème (aucune fonction de renommage/suppression
   * pour l'instant). Bloque sur un libellé déjà utilisé pour ne pas avoir deux thèmes identiques dans les listes. */
  const addTheme = async (label: string) => {
    setEditError('')
    if (quiz.categories.some((theme) => theme.label.toLowerCase() === label.toLowerCase())) {
      setEditError(t('admin.errorDuplicateTheme'))
      throw new Error('duplicate theme')
    }
    try {
      const usedIds = new Set(quiz.categories.map((theme) => theme.id))
      const updatedQuiz = parseQuiz({ ...quiz, categories: [...quiz.categories, { id: themeIdFrom(label, usedIds), label }] })
      await upsertQuiz(updatedQuiz.metadata.title, serializeQuiz(updatedQuiz))
      setQuiz(updatedQuiz)
      fetchAccessibleQuizzes().then(setHostedQuizzes).catch(() => {})
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('admin.errorAddTheme'))
      throw error
    }
  }

  /** Admin uniquement, sur un quiz hébergé actif : modifie titre/auteur/description. Passe par `updateQuiz`
   * (mise à jour par id) plutôt que `upsertQuiz` (par titre) — un simple upsert avec le nouveau titre créerait
   * une ligne en double au lieu de renommer, ou fusionnerait silencieusement avec un autre quiz du même titre. */
  const updateQuizMeta = async (title: string, author: string, description: string, quizLanguage: string, extras: QuizMetaExtras) => {
    setEditError('')
    if (hostedQuizzes.some((existing) => existing.id !== selectedHostedQuizId && existing.title === title)) {
      setEditError(t('admin.errorDuplicateTitleOther'))
      throw new Error('duplicate title')
    }
    try {
      const updatedQuiz = parseQuiz({ ...quiz, metadata: { ...quiz.metadata, title, author, description: description || undefined, language: normalizeQuizLanguage(quizLanguage) || undefined, image: extras.image, links: extras.links } })
      await updateQuiz(selectedHostedQuizId, updatedQuiz.metadata.title, serializeQuiz(updatedQuiz))
      setQuiz(updatedQuiz)
      fetchAccessibleQuizzes().then(setHostedQuizzes).catch(() => {})
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t('admin.errorUpdateQuiz'))
      throw error
    }
  }

  /** Admin uniquement : supprime définitivement un quiz hébergé après confirmation. `quiz_access` est nettoyé
   * automatiquement (FK `on delete cascade`) ; l'historique déjà enregistré garde son `quiz_id` mis à `null`
   * (FK `on delete set null`) et reste visible sous son titre figé au moment de chaque partie — par défaut il
   * n'est pas affecté, `deleteHistoryToo` permet de le purger explicitement en plus. Si le quiz supprimé était
   * le quiz actif, retombe sur le placeholder de premier affichage le temps qu'un autre quiz soit sélectionné. */
  const deleteHostedQuiz = async (id: string, title: string, deleteHistoryToo: boolean) => {
    setDeleteQuizError('')
    try {
      await deleteQuiz(id)
      setHostedQuizzes((current) => current.filter((existing) => existing.id !== id))
      if (selectedHostedQuizId === id) { setQuiz(initialQuiz); selectId('') }
      if (deleteHistoryToo) {
        try { await deleteQuizHistory(title) } catch { setDeleteQuizError(t('admin.errorDeleteQuizHistory')); return }
      }
      navigate('quizzes')
    } catch (error) {
      setDeleteQuizError(error instanceof Error ? error.message : t('admin.errorDeleteQuiz'))
    }
  }

  /** Reflète en local le résultat de `setQuizPublic` (déjà appelé par `QuizAccessManager`) — évite un aller-retour
   * réseau pour rafraîchir juste ce flag dans la liste des quiz hébergés. */
  const togglePublicLocally = (id: string, isPublic: boolean) => {
    setHostedQuizzes((current) => current.map((existing) => existing.id === id ? { ...existing, is_public: isPublic } : existing))
  }

  /** Télécharge le quiz actuellement chargé (utile pour éditer hors-ligne un quiz déjà publié). */
  const exportQuiz = () => {
    const blob = new Blob([JSON.stringify(serializeQuiz(quiz), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${quiz.metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const startQuiz = () => {
    playClick()
    setAnswers({})
    setIsReplay(false)
    setSessionQuestions(pickRandomQuestions(filteredQuestions, questionCount))
    navigate('quiz')
  }

  /** Depuis l'écran de correction : relance avec les mêmes paramètres (thèmes, difficulté, nombre, chrono) mais un
   * nouveau tirage qui évite les questions qu'on vient de jouer. `replace` plutôt que `navigate` : l'écran de
   * correction est remplacé dans l'historique, comme en fin de partie. */
  const restartQuiz = () => {
    playClick()
    setAnswers({})
    setSessionQuestions((previous) => pickFreshQuestions(filteredQuestions, previous, questionCount))
    replace('quiz')
  }

  const reviewDue = (cards: ReviewCard[]) => {
    playClick()
    setAnswers({})
    setIsReplay(true)
    setReviewBoxes(Object.fromEntries(cards.map((card) => [card.question.id, card.box])))
    setSessionQuestions(cards.map((card) => card.question))
    navigate('quiz')
  }

  /** Depuis « Mes quiz » : charge le quiz choisi et lance directement une révision sur ses cartes Leitner
   * échues (les plus fragiles d'abord). Rejette en cas d'échec de chargement pour que la page l'affiche. */
  const reviewQuizDue = async (id: string) => {
    const content = parseQuiz(await fetchQuizContent(id))
    const due = selectReviewCards(computeDueQuestions(await fetchQuestionProgress(id), content.questions), REVIEW_BATCH_SIZE)
    if (!due.length) throw new Error('no due question')
    selectId(id); setQuiz(content); applyQuizLanguage(content); setSelectedThemes([]); setDifficulty(''); setQuizLoadError('')
    reviewDue(due)
  }

  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState(false)
  /** Bouton « Réviser » de l'accueil : même session que depuis « Mes quiz », sur le quiz actif. */
  const reviewActiveQuiz = async () => {
    setReviewError(false)
    setReviewing(true)
    try { await reviewQuizDue(selectedHostedQuizId) } catch { setReviewError(true) } finally { setReviewing(false) }
  }

  const startStreak = () => {
    playClick()
    navigate('streak')
  }

  /** Relance une série avec les mêmes filtres/chrono : la page se remonte donc le pool est re-mélangé. */
  const restartStreak = () => {
    playClick()
    replace('streak')
  }

  // Enregistrement de la dernière partie : en arrière-plan, avec reprises automatiques ; un échec final est signalé sur
  // l'écran de résultat avec un bouton « Réessayer ». Le jeton écarte la réponse d'un enregistrement dépassé par une
  // partie plus récente.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' })
  const saveToken = useRef(0)
  const saveGame = (jobs: SaveJob[]) => {
    const token = ++saveToken.current
    setSaveStatus({ state: 'idle' })
    runSaveJobs(jobs).then((failed) => { if (token === saveToken.current) setSaveStatus(failed.length ? { state: 'failed', jobs: failed } : { state: 'idle' }) })
  }
  const retrySave = () => {
    if (saveStatus.state !== 'failed') return
    const token = ++saveToken.current
    const { jobs } = saveStatus
    setSaveStatus({ state: 'retrying', jobs })
    runSaveJobs(jobs).then((failed) => { if (token === saveToken.current) setSaveStatus(failed.length ? { state: 'failed', jobs: failed } : { state: 'recovered' }) })
  }

  const finishStreak = (result: StreakResult) => {
    setStreakResult(result)
    replace('streakResults')
    const payload = buildStreakResultPayload(result.streakCount, result.elapsedSeconds, result.victory, result.playedQuestions, quiz.categories, quiz.metadata.title, selectedHostedQuizId || null, isUnfiltered)
    const detailPayloads = buildQuestionResultPayloads(result.playedQuestions, result.answers, quiz.metadata.title, selectedHostedQuizId || null, payload.id, 'streak')
    saveGame([() => saveStreakResult(payload), () => saveQuestionResults(detailPayloads)])
  }

  const startTimed = () => {
    playClick()
    navigate('timed')
  }

  /** Relance un contre-la-montre avec la même durée et les mêmes filtres, sur un nouvel ordre. */
  const restartTimed = () => {
    playClick()
    replace('timed')
  }

  const finishTimed = (result: TimedResult) => {
    setTimedResult(result)
    replace('timedResults')
    const payload = buildTimedResultPayload(result.attempts, result.elapsedSeconds, result.durationSeconds, quiz.categories, quiz.metadata.title, selectedHostedQuizId || null, isUnfiltered)
    // Une partie où rien n'a été tenté (« 0 / 0 ») ne dit rien : elle n'est pas enregistrée.
    if (payload.question_count > 0) {
      const detailPayloads = buildAttemptResultPayloads(result.attempts, quiz.metadata.title, selectedHostedQuizId || null, payload.id, 'timed')
      saveGame([() => saveTimedResult(payload), () => saveQuestionResults(detailPayloads)])
    }
  }

  selectHostedQuizRef.current = selectHostedQuiz

  const backToStart = () => {
    setAnswers({})
    setSessionQuestions([])
    setElapsedSeconds(0)
    replace('start')
  }

  const toggleSound = () => {
    setSoundMuted(!muted)
    setMuted(!muted)
  }

  /** « Meilleur score classique : 🚀 Olivier — 9 bonnes réponses » : le mode et l'unité sont dits, la valeur seule (« ✓ 9 », « 8.2/min ») ne l'était pas. */
  const topScoreText = (top: NonNullable<typeof topScore>) => {
    const who = `${top.avatar} ${top.pseudo}`
    if (top.mode === 'classic') return t('topScore.classic', who, top.value ?? 0)
    if (top.mode === 'streak') return t('topScore.streak', who, top.value ?? 0, top.victory)
    return t('topScore.timed', who, top.value === null ? '' : formatNumber(top.value, language))
  }

  const breadcrumb = breadcrumbFor(view, {
    home: t('nav.home'), overview: t('crumb.overview'), profile: t('crumb.profile'), about: t('crumb.about'), admin: t('nav.admin'),
    history: t('crumb.history'), leaderboard: t('crumb.leaderboard'), quizTitle: quiz.metadata.title,
  }, selectedHostedQuizId || null)

  return <LanguageProvider language={language}><QuizLanguageProvider language={quiz.metadata.language}><main className="app-shell">
    <header className="app-header">
      <AppBar view={view} muted={muted} profile={profile} onLanguageChange={changeLanguage} onToggleSound={toggleSound} onHome={() => goTo('start')} onProfile={() => goTo('profile')} onAdmin={() => goTo('quizzes')} onLogout={onLogout} />
      {breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} label={t('nav.breadcrumb')} />}
      {/* Le quiz actif (titre, auteur, langue) n'est présenté que sur les pages qui le concernent. */}
      {isQuizPage(view) && <div className="quiz-context">
        <div className="quiz-context-head">
          {view === 'start' && <QuizCover image={quiz.metadata.image} />}
          <div>
            <h1>{quiz.metadata.title}</h1>
            <p>{t('nav.by', quiz.metadata.author)}{quiz.metadata.language && <> · {quizLanguageLabel(quiz.metadata.language, language, t)}</>}</p>
          </div>
        </div>
        {view === 'start' && <FurtherReadingInline links={quiz.metadata.links} />}
        {view === 'start' && quiz.metadata.description && <ExpandableText key={quiz.metadata.description} className="quiz-description-preview" text={quiz.metadata.description} />}
        {view === 'start' && topScore && <button type="button" className="top-score" title={t('topScore.hint')} onClick={() => viewLeaderboard('start', gameMode)}>🏆 {topScoreText(topScore)} <span aria-hidden="true">›</span></button>}
        {view === 'start' && hostedQuizzes.length > 0 && <div className="active-quiz">
  {activeCoverage?.quiz_id === selectedHostedQuizId && <>
    <CoverageBar percent={coveragePercentTenths(activeCoverage.seen_count, activeCoverage.question_count)} label={t('metric.discovered', formatPercent(coveragePercentTenths(activeCoverage.seen_count, activeCoverage.question_count), language, 1))} />
    <span className="mode-hint" title={t('metric.discoveredHint')}>{t('overview.seen', activeCoverage.seen_count, activeCoverage.question_count)} · {t('metric.discovered', formatPercent(coveragePercentTenths(activeCoverage.seen_count, activeCoverage.question_count), language, 1))}</span>
  </>}
  <div className="active-quiz-actions">
    {activeCoverage?.quiz_id === selectedHostedQuizId && activeCoverage.due_count > 0 && <button type="button" className="secondary" disabled={reviewing} onClick={reviewActiveQuiz}>{reviewing ? t('common.loading') : t('overview.review', Math.min(activeCoverage.due_count, REVIEW_BATCH_SIZE))}</button>}
    <button type="button" className="secondary" disabled={reviewing} onClick={() => { playClick(); viewHistory('start') }}>{t('overview.history')}</button>
    <button type="button" className="secondary" disabled={reviewing} onClick={() => { playClick(); viewLeaderboard('start', gameMode) }}>{t('overview.leaderboard')}</button>
    <button type="button" className="secondary" disabled={reviewing} onClick={() => { playClick(); viewOverview('start') }}>{t('nav.overview')}</button>
  </div>
  {reviewError && <p className="alert" role="alert">{t('overview.errorReview')}</p>}
</div>}
      </div>}
    </header>
    {view === 'start' && <section className="start-page">
      {quizListState === 'loading' && <p className="mode-hint">{t('start.quizListLoading')}</p>}
      {(quizListState === 'error' || quizLoadError) && <p className="alert" role="alert">{quizListState === 'error' ? t('start.quizListError') : quizLoadError} <button type="button" className="secondary alert-retry" onClick={retryQuizLoad}>{t('start.retry')}</button></p>}
      <ModePicker value={gameMode} onChange={(mode) => { playClick(); setGameMode(mode) }} />
      <FilterPanel themes={quiz.categories} selectedThemes={selectedThemes} difficulty={difficulty} onThemeToggle={toggleTheme} onDifficultyChange={setDifficulty} />
      {gameMode === 'classic' && <label className="question-count">{t('start.questionCountLabel')}<select value={questionCount} onChange={(event) => { playClick(); setQuestionCount(Number(event.target.value)) }}>{questionCounts.map((count) => <option key={count} value={count} disabled={count > filteredQuestions.length}>{t('start.questionCountOption', count, count > filteredQuestions.length)}</option>)}<option value={filteredQuestions.length}>{t('start.allQuestionsOption', filteredQuestions.length)}</option></select></label>}
      {gameMode === 'timed' && <label className="question-count">{t('start.durationLabel')}<select value={durationMinutes} onChange={(event) => { playClick(); setDurationMinutes(Number(event.target.value)) }}>{durationOptions.map((minutes) => <option key={minutes} value={minutes}>{t('start.durationOption', minutes)}</option>)}</select></label>}
      <label className="theme-checkbox timer-toggle">
        <input type="checkbox" checked={timeboxed} aria-describedby="timer-hint" onChange={(event) => { playClick(); setTimeboxed(event.target.checked) }} />
        {t('start.timerToggle')}
      </label>
      <p className="mode-hint timer-hint" id="timer-hint">{t('start.timerHint', gameMode)}</p>
      {gameMode === 'classic' && timeboxed && <p className="mode-hint">{t('start.timedEstimate', formatDuration(timedEstimateSeconds))}</p>}
      <p>{t('start.availability', filteredQuestions.length, gameMode, Math.min(questionCount, filteredQuestions.length))}</p>
      <button type="button" className="start-button" onClick={gameMode === 'classic' ? startQuiz : gameMode === 'streak' ? startStreak : startTimed} disabled={!filteredQuestions.length || !quizReady}>{gameMode === 'classic' ? t('start.startClassic') : gameMode === 'streak' ? t('start.startStreak') : t('start.startTimed')}</button>
    </section>}
    {view === 'quiz' && <QuizPage quiz={quiz} questions={sessionQuestions} timeboxed={timeboxed} reviewBoxes={isReplay ? reviewBoxes : undefined} onFinish={(nextAnswers, duration, played) => {
      setAnswers(nextAnswers); setElapsedSeconds(duration); setSessionQuestions(played); replace('results')
      const resultPayload = buildQuizResultPayload(played, nextAnswers, quiz.categories, duration, quiz.metadata.title, selectedHostedQuizId || null, isUnfiltered && !isReplay)
      const detailPayloads = buildQuestionResultPayloads(played, nextAnswers, quiz.metadata.title, selectedHostedQuizId || null, resultPayload.id)
      saveGame([
        () => saveQuizResult(resultPayload),
        () => saveQuestionResults(detailPayloads),
        ...(selectedHostedQuizId ? [createQuestionProgressJob(selectedHostedQuizId, played, nextAnswers)] : []),
      ])
    }} onCancel={backToStart} />}
    {(view === 'results' || view === 'streakResults' || view === 'timedResults') && <SaveStatusNotice status={saveStatus} onRetry={retrySave} />}
    {view === 'results' && <ResultPage links={quiz.metadata.links} reviewBoxes={isReplay ? reviewBoxes : undefined} questions={sessionQuestions} answers={answers} themes={quiz.categories} elapsedSeconds={elapsedSeconds} onRestartSame={isReplay ? undefined : restartQuiz} onBackToSettings={backToStart} onViewHistory={() => viewHistory('results')} onViewLeaderboard={() => viewLeaderboard('results')} />}
    {view === 'streak' && <StreakQuizPage quiz={quiz} pool={filteredQuestions} timeboxed={timeboxed} onFinish={finishStreak} onCancel={backToStart} />}
    {view === 'streakResults' && streakResult && <StreakResultPage links={quiz.metadata.links} {...streakResult} onRestartSame={restartStreak} onBackToSettings={backToStart} onViewHistory={() => viewHistory('streakResults')} onViewLeaderboard={() => viewLeaderboard('streakResults', 'streak')} />}
    {view === 'timed' && <TimedQuizPage quiz={quiz} pool={filteredQuestions} durationSeconds={durationMinutes * 60} timeboxed={timeboxed} onFinish={finishTimed} onCancel={backToStart} />}
    {view === 'timedResults' && timedResult && <TimedResultPage links={quiz.metadata.links} {...timedResult} onRestartSame={restartTimed} onBackToSettings={backToStart} onViewHistory={() => viewHistory('timedResults')} onViewLeaderboard={() => viewLeaderboard('timedResults', 'timed')} />}
    {view === 'quizzes' && <QuizListPage hostedQuizzes={hostedQuizzes} isAdmin={profile?.isAdmin ?? false} onBack={() => navigate('start')} onSelectQuiz={(id) => { playClick(); openQuizDetail(id) }} onCreateQuiz={createQuizAndOpen} createError={createError} onPublish={publishQuiz} publishError={publishError} publishSuccess={publishSuccess} publishWarning={publishWarning} />}
    {view === 'quizDetail' && <QuizDetailPage quiz={quiz} hostedQuizId={selectedHostedQuizId} isPublic={hostedQuizzes.find((hosted) => hosted.id === selectedHostedQuizId)?.is_public ?? false} onTogglePublic={(isPublic) => togglePublicLocally(selectedHostedQuizId, isPublic)} onBack={() => navigate('quizzes')} onExport={exportQuiz} isAdmin={profile?.isAdmin ?? false} canEditQuiz={(profile?.isAdmin ?? false) && selectedHostedQuizId !== ''} onSaveQuestion={saveQuestion} onAddQuestion={addQuestion} onDeleteQuestion={deleteQuestion} editError={editError} onAddTheme={addTheme} quizLoadError={quizLoadError} onUpdateQuizMeta={updateQuizMeta} onDeleteQuiz={deleteHostedQuiz} deleteQuizError={deleteQuizError} />}
    {view === 'overview' && <OverviewPage activeQuizId={selectedHostedQuizId} onReviewQuiz={reviewQuizDue} onViewHistory={async (id) => { playClick(); await selectHostedQuiz(id); viewHistory('overview') }} onViewLeaderboard={async (id) => { playClick(); await selectHostedQuiz(id); viewLeaderboard('overview') }} onBack={() => navigate(overviewBack)} onSelectQuiz={async (id) => { playClick(); await selectHostedQuiz(id); navigate('start') }} />}
    {view === 'history' && <HistoryPage onBack={() => navigate(historyBack)} quiz={quiz} hostedQuizId={selectedHostedQuizId} hostedQuizzes={hostedQuizzes} onReviewDue={reviewDue} onViewLeaderboard={(key, label) => { playClick(); viewLeaderboard('history', 'classic', { key, label }) }} />}
    {view === 'leaderboard' && <LeaderboardPage quiz={quiz} hostedQuizId={selectedHostedQuizId} hostedQuizzes={hostedQuizzes} initialMode={leaderboardMode} focusQuiz={leaderboardFocus} onViewOverview={() => viewOverview('leaderboard')} onBack={() => navigate(leaderboardBack)} />}
    {view === 'about' && <AboutPage onBack={() => navigate('start')} />}
    {view === 'profile' && <ProfilePage key={profile ? 'loaded' : 'loading'} profile={profile} onDirtyChange={(dirty) => { profileDirtyRef.current = dirty }} onBack={async () => { if (await confirmLeaveProfile()) navigate('start') }} onSave={async (next) => { await saveProfile(next); setProfile((current) => ({ ...current, ...next })) }} />}
    <AppFooter onAbout={() => goTo('about')} />
    <ConfirmHost />
  </main></QuizLanguageProvider></LanguageProvider>
}
