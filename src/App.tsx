import { useEffect, useMemo, useRef, useState } from 'react'
import sampleQuiz from './data/sample-quiz.json'
import { FilterPanel } from './components/FilterPanel'
import { HistoryPage } from './components/HistoryPage'
import { LeaderboardPage } from './components/LeaderboardPage'
import { ProfilePage } from './components/ProfilePage'
import { QuizDetailPage } from './components/QuizDetailPage'
import { QuizListPage } from './components/QuizListPage'
import { QuizPage } from './components/QuizPage'
import { ResultPage } from './components/ResultPage'
import { StreakQuizPage, type StreakResult } from './components/StreakQuizPage'
import { StreakResultPage } from './components/StreakResultPage'
import { TimedQuizPage, type TimedResult } from './components/TimedQuizPage'
import { TimedResultPage } from './components/TimedResultPage'
import type { AnswersByQuestion, Difficulty, GameMode, Question, Quiz } from './types/quiz'
import type { Profile } from './types/profile'
import type { LeaderboardRow } from './types/leaderboard'
import type { HostedQuizSummary } from './types/hostedQuiz'
import { buildQuestionResultPayloads, buildQuizResultPayload, buildStreakResultPayload, buildTimedResultPayload, deleteQuizHistory, saveQuestionResults, saveQuizResult, saveStreakResult, saveTimedResult } from './utils/quizHistory'
import { fetchProfile, saveProfile } from './utils/profile'
import { fetchTopScore } from './utils/leaderboard'
import { deleteQuiz, fetchAccessibleQuizzes, fetchQuizContent, updateQuiz, upsertQuiz } from './utils/hostedQuizzes'
import { applyTheme } from './utils/theme'
import { LanguageProvider, translate } from './i18n'
import type { Language, TranslationKey } from './i18n'
import { parseQuiz } from './utils/quizValidation'
import { isSoundMuted, playClick, setSoundMuted } from './utils/sound'
import { shuffle } from './utils/shuffle'

type View = 'start' | 'quiz' | 'results' | 'streak' | 'streakResults' | 'timed' | 'timedResults' | 'quizzes' | 'quizDetail' | 'history' | 'leaderboard' | 'profile'

/** Premier affichage seulement, le temps de charger la liste des quiz hébergés — le quiz "Culture générale"
 * vit désormais en base (`020_public_quizzes.sql`, `is_public`) et devient le quiz actif réel dès que ce
 * fetch répond, avec un vrai id (éditable comme n'importe quel quiz hébergé). */
const initialQuiz = parseQuiz(sampleQuiz)
const questionCounts = [5, 10, 20, 30, 50]
/** En minutes ; 0 = mode "Infini" (pas de limite). */
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
  const [view, setView] = useState<View>('start')
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [publishError, setPublishError] = useState('')
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [editError, setEditError] = useState('')
  const [createError, setCreateError] = useState('')
  const [deleteQuizError, setDeleteQuizError] = useState('')
  const [quizLoadError, setQuizLoadError] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [sessionQuestions, setSessionQuestions] = useState<Quiz['questions']>([])
  // Une partie "reprendre mes erreurs" ne porte que sur un sous-ensemble ciblé de questions, pas sur le
  // pool filtré normal : elle ne doit jamais compter comme "sans filtre" pour le classement.
  const [isReplay, setIsReplay] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [streakResult, setStreakResult] = useState<StreakResult | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(10)
  const [timedResult, setTimedResult] = useState<TimedResult | null>(null)
  const [timeboxed, setTimeboxed] = useState(false)
  const [muted, setMuted] = useState(isSoundMuted())
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => { fetchProfile().then(setProfile).catch(() => {}) }, [])
  useEffect(() => { applyTheme(profile?.theme ?? 'dark') }, [profile?.theme])
  // La langue doit faire re-render tout l'arbre (contrairement au thème, un simple attribut DOM) : elle vit
  // comme un état React fourni via `LanguageProvider`, synchronisé depuis le profil comme le thème l'est.
  const [language, setLanguage] = useState<Language>('fr')
  useEffect(() => { setLanguage(profile?.language ?? 'fr') }, [profile?.language])
  // `App` rend lui-même `LanguageProvider` plus bas : il ne peut donc pas consommer son propre contexte via
  // `useTranslation()` (un composant ne voit pas le contexte qu'il fournit à ses descendants) — on appelle
  // directement `translate` avec l'état local `language` à la place.
  const t = (key: TranslationKey, ...args: unknown[]) => translate(language, key, ...args)
  const [hostedQuizzes, setHostedQuizzes] = useState<HostedQuizSummary[]>([])
  const [selectedHostedQuizId, setSelectedHostedQuizId] = useState('')
  // Le quiz d'exemple bundlé (`initialQuiz`) ne sert plus que de premier affichage le temps de ce fetch : dès
  // qu'un quiz `is_public` existe en base, il devient le quiz actif réel (avec un vrai id, éditable comme
  // n'importe quel quiz hébergé) — sauf si l'utilisateur a déjà sélectionné autre chose entre-temps.
  useEffect(() => {
    fetchAccessibleQuizzes().then((quizzes) => {
      setHostedQuizzes(quizzes)
      if (!selectedHostedQuizId) {
        const defaultQuiz = quizzes.find((hosted) => hosted.is_public)
        if (defaultQuiz) selectHostedQuiz(defaultQuiz.id)
      }
    }).catch(() => {})
  }, [])
  const [topScore, setTopScore] = useState<LeaderboardRow | null>(null)
  useEffect(() => { if (view === 'start') fetchTopScore(quiz.metadata.title, selectedHostedQuizId || null).then(setTopScore).catch(() => setTopScore(null)) }, [view, quiz.metadata.title, selectedHostedQuizId])
  const [leaderboardBack, setLeaderboardBack] = useState<View>('profile')
  const [leaderboardMode, setLeaderboardMode] = useState<GameMode>('classic')
  const viewLeaderboard = (from: View, mode: GameMode = 'classic') => { setLeaderboardBack(from); setLeaderboardMode(mode); navigate('leaderboard') }
  const [historyBack, setHistoryBack] = useState<View>('profile')
  const viewHistory = (from: View) => { setHistoryBack(from); navigate('history') }

  // Le back/swipe-back du navigateur doit se comporter comme le bouton "Retour" de l'appli plutôt que la quitter :
  // chaque navigation interne pousse une entrée d'historique, et on resynchronise `view` sur popstate.
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  useEffect(() => {
    window.history.replaceState({ view: 'start' }, '')
    const onPopState = (event: PopStateEvent) => {
      const nextView = (event.state?.view as View | undefined) ?? 'start'
      if ((viewRef.current === 'quiz' || viewRef.current === 'streak' || viewRef.current === 'timed') && nextView !== viewRef.current) {
        if (!window.confirm(t('start.confirmAbandon'))) {
          window.history.pushState({ view: viewRef.current }, '')
          return
        }
        setAnswers({}); setSessionQuestions([]); setElapsedSeconds(0)
      }
      setView(nextView)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const navigate = (next: View) => { setView(next); window.history.pushState({ view: next }, '') }
  // Remplace l'entrée d'historique courante plutôt que d'en empiler une nouvelle : utilisé pour quitter
  // "quiz" (fin de partie ou abandon), qui n'est pas un état vers lequel on veut pouvoir revenir en arrière.
  const replace = (next: View) => { setView(next); window.history.replaceState({ view: next }, '') }
  const filteredQuestions = useMemo(() => quiz.questions.filter((question) =>
    (!selectedThemes.length || selectedThemes.includes(question.theme)) && (!difficulty || question.difficulty === difficulty)), [quiz, selectedThemes, difficulty])
  // Seules les parties jouées sans filtre comptent pour le classement : sinon un thème/une difficulté
  // choisie exprès rendrait les scores/streaks/rythmes incomparables entre joueurs.
  const isUnfiltered = selectedThemes.length === 0 && difficulty === ''

  const toggleTheme = (themeId: string) => setSelectedThemes((previous) =>
    previous.includes(themeId) ? previous.filter((id) => id !== themeId) : [...previous, themeId])

  const selectHostedQuiz = async (id: string) => {
    setSelectedHostedQuizId(id)
    if (!id) { setQuiz(initialQuiz); setSelectedThemes([]); setDifficulty(''); setSessionQuestions([]); setQuizLoadError(''); return }
    try {
      setQuiz(parseQuiz(await fetchQuizContent(id)))
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
  const createQuiz = async (title: string, author: string, description: string, themeLabels: string[]) => {
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
        metadata: { title, author, createdAt: new Date().toISOString(), description: description || undefined },
        themes,
        questions: [],
      })
      const id = await upsertQuiz(newQuiz.metadata.title, newQuiz)
      setQuiz(newQuiz)
      setSelectedHostedQuizId(id)
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
  const createQuizAndOpen = async (title: string, author: string, description: string, themeLabels: string[]) => {
    await createQuiz(title, author, description, themeLabels)
    navigate('quizDetail')
  }

  /** Admin uniquement : publie un quiz (crée ou met à jour par titre) — n'accorde jamais d'accès automatiquement. */
  const publishQuiz = async (file?: File) => {
    if (!file) return
    setPublishSuccess(false)
    try {
      const content = JSON.parse(await file.text())
      const parsed = parseQuiz(content)
      await upsertQuiz(parsed.metadata.title, content)
      setPublishError('')
      setPublishSuccess(true)
      fetchAccessibleQuizzes().then(setHostedQuizzes).catch(() => {})
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : t('admin.errorInvalidJson'))
    }
  }

  /** Revalide l'ensemble du quiz avec la liste de questions donnée puis republie sous le même titre
   * (mêmes accès `quiz_access` conservés, cf. upsert par titre). Partagé par édition/ajout/suppression. */
  const republishQuestions = async (questions: Question[]) => {
    const updatedQuiz = parseQuiz({ ...quiz, questions })
    await upsertQuiz(updatedQuiz.metadata.title, updatedQuiz)
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
    if (!window.confirm(t('admin.confirmDeleteQuestion'))) return
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
    if (quiz.themes.some((theme) => theme.label.toLowerCase() === label.toLowerCase())) {
      setEditError(t('admin.errorDuplicateTheme'))
      throw new Error('duplicate theme')
    }
    try {
      const usedIds = new Set(quiz.themes.map((theme) => theme.id))
      const updatedQuiz = parseQuiz({ ...quiz, themes: [...quiz.themes, { id: themeIdFrom(label, usedIds), label }] })
      await upsertQuiz(updatedQuiz.metadata.title, updatedQuiz)
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
  const updateQuizMeta = async (title: string, author: string, description: string) => {
    setEditError('')
    if (hostedQuizzes.some((existing) => existing.id !== selectedHostedQuizId && existing.title === title)) {
      setEditError(t('admin.errorDuplicateTitleOther'))
      throw new Error('duplicate title')
    }
    try {
      const updatedQuiz = parseQuiz({ ...quiz, metadata: { ...quiz.metadata, title, author, description: description || undefined } })
      await updateQuiz(selectedHostedQuizId, updatedQuiz.metadata.title, updatedQuiz)
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
    if (!window.confirm(t('admin.confirmDeleteQuiz', title, deleteHistoryToo))) return
    setDeleteQuizError('')
    try {
      await deleteQuiz(id)
      setHostedQuizzes((current) => current.filter((existing) => existing.id !== id))
      if (selectedHostedQuizId === id) { setQuiz(initialQuiz); setSelectedHostedQuizId('') }
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
    const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' })
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

  const replayMissed = (questions: Question[]) => {
    playClick()
    setAnswers({})
    setIsReplay(true)
    setSessionQuestions(questions)
    navigate('quiz')
  }

  const startStreak = () => {
    playClick()
    navigate('streak')
  }

  const finishStreak = (result: StreakResult) => {
    setStreakResult(result)
    replace('streakResults')
    saveStreakResult(buildStreakResultPayload(result.streakCount, result.elapsedSeconds, result.victory, result.playedQuestions, quiz.themes, quiz.metadata.title, selectedHostedQuizId || null, isUnfiltered))
  }

  const startTimed = () => {
    playClick()
    navigate('timed')
  }

  const finishTimed = (result: TimedResult) => {
    setTimedResult(result)
    replace('timedResults')
    saveTimedResult(buildTimedResultPayload(result.attempts, result.elapsedSeconds, result.durationSeconds, quiz.themes, quiz.metadata.title, selectedHostedQuizId || null, isUnfiltered))
  }

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

  return <LanguageProvider language={language}><main className="app-shell">
    <header><div><p className="eyebrow">OLIVER QUIZ</p><h1>{quiz.metadata.title}</h1><p>{t('nav.by', quiz.metadata.author)}</p>{view === 'start' && quiz.metadata.description && <p className="quiz-description-preview">{quiz.metadata.description}</p>}{view === 'start' && topScore && <button type="button" className="top-score" onClick={() => viewLeaderboard('start')}>🏆 {topScore.avatar} {topScore.pseudo} — {topScore.best_score}%</button>}</div><div className="header-actions"><button type="button" className="secondary" onClick={toggleSound} aria-label={muted ? t('nav.unmuteSound') : t('nav.muteSound')}>{muted ? '🔇' : '🔊'}</button>{view === 'start' && <button type="button" className="secondary" onClick={() => navigate('profile')}>{profile ? `${profile.avatar} ${profile.pseudo}` : t('nav.profile')}</button>}{view === 'start' && <button type="button" className="secondary" onClick={() => navigate('quizzes')}>{t('nav.quiz')}</button>}<button type="button" className="secondary" onClick={onLogout}>{t('common.logout')}</button></div></header>
    {view === 'start' && <section className="start-page">
      {hostedQuizzes.length > 0 && <label className="quiz-select">{t('start.quizLabel')}
        <select value={selectedHostedQuizId} onChange={(event) => { playClick(); selectHostedQuiz(event.target.value) }}>
          {hostedQuizzes.map((hosted) => <option key={hosted.id} value={hosted.id}>{hosted.title}</option>)}
        </select>
      </label>}
      {quizLoadError && <p className="alert" role="alert">{quizLoadError}</p>}
      <div className="mode-picker" role="group" aria-label={t('start.modeGroupLabel')}>
        <button type="button" className={gameMode === 'classic' ? 'mode-option active' : 'mode-option'} onClick={() => { playClick(); setGameMode('classic') }}>{t('common.modeClassic')}</button>
        <button type="button" className={gameMode === 'streak' ? 'mode-option active' : 'mode-option'} onClick={() => { playClick(); setGameMode('streak') }}>{t('common.modeStreak')}</button>
        <button type="button" className={gameMode === 'timed' ? 'mode-option active' : 'mode-option'} onClick={() => { playClick(); setGameMode('timed') }}>{t('common.modeTimed')}</button>
      </div>
      <FilterPanel themes={quiz.themes} selectedThemes={selectedThemes} difficulty={difficulty} onThemeToggle={toggleTheme} onDifficultyChange={setDifficulty} />
      {gameMode === 'classic' && <label className="question-count">{t('start.questionCountLabel')}<select value={questionCount} onChange={(event) => { playClick(); setQuestionCount(Number(event.target.value)) }}>{questionCounts.map((count) => <option key={count} value={count} disabled={count > filteredQuestions.length}>{t('start.questionCountOption', count, count > filteredQuestions.length)}</option>)}<option value={filteredQuestions.length}>{t('start.allQuestionsOption', filteredQuestions.length)}</option></select></label>}
      {gameMode === 'streak' && <p className="mode-hint">{t('start.streakHint')}</p>}
      {gameMode === 'timed' && <label className="question-count">{t('start.durationLabel')}<select value={durationMinutes} onChange={(event) => { playClick(); setDurationMinutes(Number(event.target.value)) }}>{durationOptions.map((minutes) => <option key={minutes} value={minutes}>{t('start.durationOption', minutes)}</option>)}</select></label>}
      <label className="theme-checkbox timer-toggle">
        <input type="checkbox" checked={timeboxed} onChange={(event) => { playClick(); setTimeboxed(event.target.checked) }} />
        {t('start.timerToggle')}
      </label>
      <p>{t('start.availability', filteredQuestions.length, gameMode, Math.min(questionCount, filteredQuestions.length))}</p>
      <button type="button" onClick={gameMode === 'classic' ? startQuiz : gameMode === 'streak' ? startStreak : startTimed} disabled={!filteredQuestions.length}>{gameMode === 'classic' ? t('start.startClassic') : gameMode === 'streak' ? t('start.startStreak') : t('start.startTimed')}</button>
    </section>}
    {view === 'quiz' && <QuizPage quiz={quiz} questions={sessionQuestions} timeboxed={timeboxed} onFinish={(nextAnswers, duration) => {
      setAnswers(nextAnswers); setElapsedSeconds(duration); replace('results')
      saveQuizResult(buildQuizResultPayload(sessionQuestions, nextAnswers, quiz.themes, duration, quiz.metadata.title, selectedHostedQuizId || null, isUnfiltered && !isReplay))
      saveQuestionResults(buildQuestionResultPayloads(sessionQuestions, nextAnswers, quiz.metadata.title, selectedHostedQuizId || null))
    }} onCancel={backToStart} />}
    {view === 'results' && <ResultPage questions={sessionQuestions} answers={answers} themes={quiz.themes} elapsedSeconds={elapsedSeconds} onRestart={backToStart} onViewHistory={() => viewHistory('results')} onViewLeaderboard={() => viewLeaderboard('results')} />}
    {view === 'streak' && <StreakQuizPage quiz={quiz} pool={filteredQuestions} timeboxed={timeboxed} onFinish={finishStreak} onCancel={backToStart} />}
    {view === 'streakResults' && streakResult && <StreakResultPage {...streakResult} onRestart={backToStart} onViewHistory={() => viewHistory('streakResults')} onViewLeaderboard={() => viewLeaderboard('streakResults', 'streak')} />}
    {view === 'timed' && <TimedQuizPage quiz={quiz} pool={filteredQuestions} durationSeconds={durationMinutes * 60} timeboxed={timeboxed} onFinish={finishTimed} onCancel={backToStart} />}
    {view === 'timedResults' && timedResult && <TimedResultPage {...timedResult} onRestart={backToStart} onViewHistory={() => viewHistory('timedResults')} onViewLeaderboard={() => viewLeaderboard('timedResults', 'timed')} />}
    {view === 'quizzes' && <QuizListPage hostedQuizzes={hostedQuizzes} isAdmin={profile?.isAdmin ?? false} onBack={() => navigate('start')} onSelectQuiz={(id) => { playClick(); openQuizDetail(id) }} onCreateQuiz={createQuizAndOpen} createError={createError} onPublish={publishQuiz} publishError={publishError} publishSuccess={publishSuccess} />}
    {view === 'quizDetail' && <QuizDetailPage quiz={quiz} hostedQuizId={selectedHostedQuizId} isPublic={hostedQuizzes.find((hosted) => hosted.id === selectedHostedQuizId)?.is_public ?? false} onTogglePublic={(isPublic) => togglePublicLocally(selectedHostedQuizId, isPublic)} onBack={() => navigate('quizzes')} onExport={exportQuiz} isAdmin={profile?.isAdmin ?? false} canEditQuiz={(profile?.isAdmin ?? false) && selectedHostedQuizId !== ''} onSaveQuestion={saveQuestion} onAddQuestion={addQuestion} onDeleteQuestion={deleteQuestion} editError={editError} onAddTheme={addTheme} quizLoadError={quizLoadError} onUpdateQuizMeta={updateQuizMeta} onDeleteQuiz={deleteHostedQuiz} deleteQuizError={deleteQuizError} />}
    {view === 'history' && <HistoryPage onBack={() => navigate(historyBack)} quiz={quiz} hostedQuizId={selectedHostedQuizId} onReplayMissed={replayMissed} />}
    {view === 'leaderboard' && <LeaderboardPage quiz={quiz} hostedQuizId={selectedHostedQuizId} initialMode={leaderboardMode} onBack={() => navigate(leaderboardBack)} />}
    {view === 'profile' && <ProfilePage profile={profile} onBack={() => navigate('start')} onSave={async (next) => { await saveProfile(next); setProfile((current) => ({ ...current, ...next })) }} onViewHistory={() => viewHistory('profile')} onViewLeaderboard={() => viewLeaderboard('profile')} onPreviewLanguage={setLanguage} />}
  </main></LanguageProvider>
}
