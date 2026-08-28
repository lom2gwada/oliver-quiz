import { useEffect, useMemo, useState } from 'react'
import sampleQuiz from './data/sample-quiz.json'
import { FilterPanel } from './components/FilterPanel'
import { HistoryPage } from './components/HistoryPage'
import { LeaderboardPage } from './components/LeaderboardPage'
import { ProfilePage } from './components/ProfilePage'
import { QuizContentPage } from './components/QuizContentPage'
import { QuizPage } from './components/QuizPage'
import { ResultPage } from './components/ResultPage'
import type { AnswersByQuestion, Difficulty, Quiz, Question } from './types/quiz'
import type { Profile } from './types/profile'
import type { LeaderboardRow } from './types/leaderboard'
import { buildQuestionResultPayloads, buildQuizResultPayload, saveQuestionResults, saveQuizResult } from './utils/quizHistory'
import { fetchProfile, saveProfile } from './utils/profile'
import { fetchTopScore } from './utils/leaderboard'
import { parseQuiz } from './utils/quizValidation'
import { isSoundMuted, playClick, setSoundMuted } from './utils/sound'
import { shuffle } from './utils/shuffle'

type View = 'start' | 'quiz' | 'results' | 'content' | 'history' | 'leaderboard' | 'profile'

const initialQuiz = parseQuiz(sampleQuiz)
const questionCounts = [5, 10, 20, 30, 50]

function pickRandomQuestions<T>(questions: T[], count: number): T[] {
  return shuffle(questions).slice(0, Math.min(count, questions.length))
}

export default function App({ onLogout }: { onLogout: () => void }) {
  const [quiz, setQuiz] = useState<Quiz>(initialQuiz)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')
  const [view, setView] = useState<View>('start')
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [fileError, setFileError] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [sessionQuestions, setSessionQuestions] = useState<Quiz['questions']>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [muted, setMuted] = useState(isSoundMuted())
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => { fetchProfile().then(setProfile).catch(() => {}) }, [])
  const [topScore, setTopScore] = useState<LeaderboardRow | null>(null)
  const refreshTopScore = () => { fetchTopScore(quiz.metadata.title).then(setTopScore).catch(() => setTopScore(null)) }
  useEffect(refreshTopScore, [quiz.metadata.title])
  const [leaderboardBack, setLeaderboardBack] = useState<View>('profile')
  const viewLeaderboard = (from: View) => { setLeaderboardBack(from); setView('leaderboard') }
  const filteredQuestions = useMemo(() => quiz.questions.filter((question) =>
    (!selectedThemes.length || selectedThemes.includes(question.theme)) && (!difficulty || question.difficulty === difficulty)), [quiz, selectedThemes, difficulty])

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

  const startQuiz = () => {
    playClick()
    setAnswers({})
    setSessionQuestions(pickRandomQuestions(filteredQuestions, questionCount))
    setView('quiz')
  }

  const replayMissed = (questions: Question[]) => {
    playClick()
    setAnswers({})
    setSessionQuestions(questions)
    setView('quiz')
  }

  const backToStart = () => {
    setAnswers({})
    setSessionQuestions([])
    setElapsedSeconds(0)
    setView('start')
    refreshTopScore()
  }

  const toggleSound = () => {
    setSoundMuted(!muted)
    setMuted(!muted)
  }

  return <main className="app-shell">
    <header><div><p className="eyebrow">OLIVER QUIZ</p><h1>{quiz.metadata.title}</h1><p>par {quiz.metadata.author}</p>{view === 'start' && topScore && <button type="button" className="top-score" onClick={() => viewLeaderboard('start')}>🏆 {topScore.avatar} {topScore.pseudo} — {topScore.best_score}%</button>}</div><div className="header-actions"><button type="button" className="secondary" onClick={toggleSound} aria-label={muted ? 'Activer le son' : 'Couper le son'}>{muted ? '🔇' : '🔊'}</button>{view === 'start' && <button type="button" className="secondary" onClick={() => setView('profile')}>{profile ? `${profile.avatar} ${profile.pseudo}` : '👤 Profil'}</button>}{view === 'start' && <button type="button" className="secondary" onClick={() => setView('content')}>⚙️ Quiz</button>}<button type="button" className="secondary" onClick={onLogout}>Se déconnecter</button></div></header>
    {view === 'start' && <section className="start-page"><FilterPanel themes={quiz.themes} selectedThemes={selectedThemes} difficulty={difficulty} onThemeToggle={toggleTheme} onDifficultyChange={setDifficulty} /><label className="question-count">Nombre de questions<select value={questionCount} onChange={(event) => { playClick(); setQuestionCount(Number(event.target.value)) }}>{questionCounts.map((count) => <option key={count} value={count} disabled={count > filteredQuestions.length}>{count} {count === 1 ? 'question' : 'questions'}{count > filteredQuestions.length ? ' (indisponible)' : ''}</option>)}<option value={filteredQuestions.length}>Toutes les questions ({filteredQuestions.length})</option></select></label><p>{filteredQuestions.length} question{filteredQuestions.length > 1 ? 's' : ''} disponible{filteredQuestions.length > 1 ? 's' : ''} — {Math.min(questionCount, filteredQuestions.length)} seront tirées aléatoirement.</p><button type="button" onClick={startQuiz} disabled={!filteredQuestions.length}>Démarrer le quiz</button></section>}
    {view === 'quiz' && <QuizPage quiz={quiz} questions={sessionQuestions} onFinish={(nextAnswers, duration) => {
      setAnswers(nextAnswers); setElapsedSeconds(duration); setView('results')
      saveQuizResult(buildQuizResultPayload(sessionQuestions, nextAnswers, quiz.themes, duration, quiz.metadata.title))
      saveQuestionResults(buildQuestionResultPayloads(sessionQuestions, nextAnswers, quiz.metadata.title))
    }} onCancel={backToStart} />}
    {view === 'results' && <ResultPage questions={sessionQuestions} answers={answers} themes={quiz.themes} elapsedSeconds={elapsedSeconds} onRestart={backToStart} />}
    {view === 'content' && <QuizContentPage quiz={quiz} onBack={() => setView('start')} onFileChange={loadFile} fileError={fileError} />}
    {view === 'history' && <HistoryPage onBack={() => setView('profile')} quiz={quiz} onReplayMissed={replayMissed} />}
    {view === 'leaderboard' && <LeaderboardPage quiz={quiz} onBack={() => setView(leaderboardBack)} />}
    {view === 'profile' && <ProfilePage profile={profile} onBack={() => setView('start')} onSave={async (next) => { await saveProfile(next); setProfile(next) }} onViewHistory={() => setView('history')} onViewLeaderboard={() => viewLeaderboard('profile')} />}
  </main>
}
