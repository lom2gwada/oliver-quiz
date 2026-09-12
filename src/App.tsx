import { useEffect, useMemo, useRef, useState } from 'react'
import sampleQuiz from './data/sample-quiz.json'
import { FilterPanel } from './components/FilterPanel'
import { HistoryPage } from './components/HistoryPage'
import { LeaderboardPage } from './components/LeaderboardPage'
import { ProfilePage } from './components/ProfilePage'
import { QuizContentPage } from './components/QuizContentPage'
import { QuizPage } from './components/QuizPage'
import { ResultPage } from './components/ResultPage'
import { StreakQuizPage, type StreakResult } from './components/StreakQuizPage'
import { StreakResultPage } from './components/StreakResultPage'
import { TimedQuizPage, type TimedResult } from './components/TimedQuizPage'
import { TimedResultPage } from './components/TimedResultPage'
import type { AnswersByQuestion, Difficulty, GameMode, Quiz, Question } from './types/quiz'
import type { Profile } from './types/profile'
import type { LeaderboardRow } from './types/leaderboard'
import type { HostedQuizSummary } from './types/hostedQuiz'
import { buildQuestionResultPayloads, buildQuizResultPayload, buildStreakResultPayload, buildTimedResultPayload, saveQuestionResults, saveQuizResult, saveStreakResult, saveTimedResult } from './utils/quizHistory'
import { fetchProfile, saveProfile } from './utils/profile'
import { fetchTopScore } from './utils/leaderboard'
import { fetchAccessibleQuizzes, fetchQuizContent } from './utils/hostedQuizzes'
import { applyTheme } from './utils/theme'
import { parseQuiz } from './utils/quizValidation'
import { isSoundMuted, playClick, setSoundMuted } from './utils/sound'
import { shuffle } from './utils/shuffle'

type View = 'start' | 'quiz' | 'results' | 'streak' | 'streakResults' | 'timed' | 'timedResults' | 'content' | 'history' | 'leaderboard' | 'profile'

const initialQuiz = parseQuiz(sampleQuiz)
const questionCounts = [5, 10, 20, 30, 50]
/** En minutes ; 0 = mode "Infini" (pas de limite). */
const durationOptions = [5, 10, 15, 20, 0]

function pickRandomQuestions<T>(questions: T[], count: number): T[] {
  return shuffle(questions).slice(0, Math.min(count, questions.length))
}

export default function App({ onLogout }: { onLogout: () => void }) {
  const [quiz, setQuiz] = useState<Quiz>(initialQuiz)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')
  const [gameMode, setGameMode] = useState<GameMode>('classic')
  const [view, setView] = useState<View>('start')
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [fileError, setFileError] = useState('')
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
  const [hostedQuizzes, setHostedQuizzes] = useState<HostedQuizSummary[]>([])
  const [selectedHostedQuizId, setSelectedHostedQuizId] = useState('')
  useEffect(() => { fetchAccessibleQuizzes().then(setHostedQuizzes).catch(() => {}) }, [])
  const [topScore, setTopScore] = useState<LeaderboardRow | null>(null)
  useEffect(() => { if (view === 'start') fetchTopScore(quiz.metadata.title).then(setTopScore).catch(() => setTopScore(null)) }, [view, quiz.metadata.title])
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
        if (!window.confirm('Abandonner la partie en cours ? Votre progression sera perdue.')) {
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

  const loadFile = async (file?: File) => {
    if (!file) return
    try {
      setQuiz(parseQuiz(JSON.parse(await file.text())))
      setSelectedThemes([]); setDifficulty(''); setSessionQuestions([]); setFileError('')
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Fichier JSON invalide.')
    }
  }

  const selectHostedQuiz = async (id: string) => {
    setSelectedHostedQuizId(id)
    if (!id) { setQuiz(initialQuiz); setSelectedThemes([]); setDifficulty(''); setSessionQuestions([]); return }
    try {
      setQuiz(parseQuiz(await fetchQuizContent(id)))
      setSelectedThemes([]); setDifficulty(''); setSessionQuestions([]); setFileError('')
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Impossible de charger ce quiz.')
    }
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
    saveStreakResult(buildStreakResultPayload(result.streakCount, result.elapsedSeconds, result.victory, result.playedQuestions, quiz.themes, quiz.metadata.title, isUnfiltered))
  }

  const startTimed = () => {
    playClick()
    navigate('timed')
  }

  const finishTimed = (result: TimedResult) => {
    setTimedResult(result)
    replace('timedResults')
    saveTimedResult(buildTimedResultPayload(result.attempts, result.elapsedSeconds, result.durationSeconds, quiz.themes, quiz.metadata.title, isUnfiltered))
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

  return <main className="app-shell">
    <header><div><p className="eyebrow">OLIVER QUIZ</p><h1>{quiz.metadata.title}</h1><p>par {quiz.metadata.author}</p>{view === 'start' && quiz.metadata.description && <p className="quiz-description-preview">{quiz.metadata.description}</p>}{view === 'start' && topScore && <button type="button" className="top-score" onClick={() => viewLeaderboard('start')}>🏆 {topScore.avatar} {topScore.pseudo} — {topScore.best_score}%</button>}</div><div className="header-actions"><button type="button" className="secondary" onClick={toggleSound} aria-label={muted ? 'Activer le son' : 'Couper le son'}>{muted ? '🔇' : '🔊'}</button>{view === 'start' && <button type="button" className="secondary" onClick={() => navigate('profile')}>{profile ? `${profile.avatar} ${profile.pseudo}` : '👤 Profil'}</button>}{view === 'start' && <button type="button" className="secondary" onClick={() => navigate('content')}>⚙️ Quiz</button>}<button type="button" className="secondary" onClick={onLogout}>Se déconnecter</button></div></header>
    {view === 'start' && <section className="start-page">
      {hostedQuizzes.length > 0 && <label className="quiz-select">Quiz
        <select value={selectedHostedQuizId} onChange={(event) => { playClick(); selectHostedQuiz(event.target.value) }}>
          <option value="">Culture générale (exemple)</option>
          {hostedQuizzes.map((hosted) => <option key={hosted.id} value={hosted.id}>{hosted.title}</option>)}
        </select>
      </label>}
      <div className="mode-picker" role="group" aria-label="Mode de jeu">
        <button type="button" className={gameMode === 'classic' ? 'mode-option active' : 'mode-option'} onClick={() => { playClick(); setGameMode('classic') }}>🎯 Classique</button>
        <button type="button" className={gameMode === 'streak' ? 'mode-option active' : 'mode-option'} onClick={() => { playClick(); setGameMode('streak') }}>🔥 Sans-faute</button>
        <button type="button" className={gameMode === 'timed' ? 'mode-option active' : 'mode-option'} onClick={() => { playClick(); setGameMode('timed') }}>⏱️ Contre-la-montre</button>
      </div>
      <FilterPanel themes={quiz.themes} selectedThemes={selectedThemes} difficulty={difficulty} onThemeToggle={toggleTheme} onDifficultyChange={setDifficulty} />
      {gameMode === 'classic' && <label className="question-count">Nombre de questions<select value={questionCount} onChange={(event) => { playClick(); setQuestionCount(Number(event.target.value)) }}>{questionCounts.map((count) => <option key={count} value={count} disabled={count > filteredQuestions.length}>{count} {count === 1 ? 'question' : 'questions'}{count > filteredQuestions.length ? ' (indisponible)' : ''}</option>)}<option value={filteredQuestions.length}>Toutes les questions ({filteredQuestions.length})</option></select></label>}
      {gameMode === 'streak' && <p className="mode-hint">Répondez correctement à la chaîne, sans limite de temps : la partie s'arrête à la première erreur.</p>}
      {gameMode === 'timed' && <label className="question-count">Durée<select value={durationMinutes} onChange={(event) => { playClick(); setDurationMinutes(Number(event.target.value)) }}>{durationOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes === 0 ? 'Infini' : `${minutes} minutes`}</option>)}</select></label>}
      <label className="theme-checkbox timer-toggle">
        <input type="checkbox" checked={timeboxed} onChange={(event) => { playClick(); setTimeboxed(event.target.checked) }} />
        ⏳ Chrono par question
      </label>
      <p>{filteredQuestions.length} question{filteredQuestions.length > 1 ? 's' : ''} disponible{filteredQuestions.length > 1 ? 's' : ''}{gameMode === 'classic' ? ` — ${Math.min(questionCount, filteredQuestions.length)} seront tirées aléatoirement.` : gameMode === 'timed' ? ' — elles peuvent revenir plusieurs fois si le temps le permet.' : '.'}</p>
      <button type="button" onClick={gameMode === 'classic' ? startQuiz : gameMode === 'streak' ? startStreak : startTimed} disabled={!filteredQuestions.length}>{gameMode === 'classic' ? 'Démarrer le quiz' : gameMode === 'streak' ? 'Démarrer la série' : 'Démarrer le chrono'}</button>
    </section>}
    {view === 'quiz' && <QuizPage quiz={quiz} questions={sessionQuestions} timeboxed={timeboxed} onFinish={(nextAnswers, duration) => {
      setAnswers(nextAnswers); setElapsedSeconds(duration); replace('results')
      saveQuizResult(buildQuizResultPayload(sessionQuestions, nextAnswers, quiz.themes, duration, quiz.metadata.title, isUnfiltered && !isReplay))
      saveQuestionResults(buildQuestionResultPayloads(sessionQuestions, nextAnswers, quiz.metadata.title))
    }} onCancel={backToStart} />}
    {view === 'results' && <ResultPage questions={sessionQuestions} answers={answers} themes={quiz.themes} elapsedSeconds={elapsedSeconds} onRestart={backToStart} onViewHistory={() => viewHistory('results')} onViewLeaderboard={() => viewLeaderboard('results')} />}
    {view === 'streak' && <StreakQuizPage quiz={quiz} pool={filteredQuestions} timeboxed={timeboxed} onFinish={finishStreak} onCancel={backToStart} />}
    {view === 'streakResults' && streakResult && <StreakResultPage {...streakResult} onRestart={backToStart} onViewHistory={() => viewHistory('streakResults')} onViewLeaderboard={() => viewLeaderboard('streakResults', 'streak')} />}
    {view === 'timed' && <TimedQuizPage quiz={quiz} pool={filteredQuestions} durationSeconds={durationMinutes * 60} timeboxed={timeboxed} onFinish={finishTimed} onCancel={backToStart} />}
    {view === 'timedResults' && timedResult && <TimedResultPage {...timedResult} onRestart={backToStart} onViewHistory={() => viewHistory('timedResults')} onViewLeaderboard={() => viewLeaderboard('timedResults', 'timed')} />}
    {view === 'content' && <QuizContentPage quiz={quiz} onBack={() => navigate('start')} onFileChange={loadFile} fileError={fileError} isAdmin={profile?.isAdmin ?? false} />}
    {view === 'history' && <HistoryPage onBack={() => navigate(historyBack)} quiz={quiz} onReplayMissed={replayMissed} />}
    {view === 'leaderboard' && <LeaderboardPage quiz={quiz} initialMode={leaderboardMode} onBack={() => navigate(leaderboardBack)} />}
    {view === 'profile' && <ProfilePage profile={profile} onBack={() => navigate('start')} onSave={async (next) => { await saveProfile(next); setProfile((current) => ({ ...current, ...next })) }} onViewHistory={() => viewHistory('profile')} onViewLeaderboard={() => viewLeaderboard('profile')} />}
  </main>
}
