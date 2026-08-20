import { useMemo, useState } from 'react'
import sampleQuiz from './data/sample-quiz.json'
import { FilterPanel } from './components/FilterPanel'
import { QuizPage } from './components/QuizPage'
import { ResultPage } from './components/ResultPage'
import { StatsPage } from './components/StatsPage'
import type { AnswersByQuestion, Difficulty, Quiz } from './types/quiz'
import { parseQuiz } from './utils/quizValidation'
import { isSoundMuted, playClick, setSoundMuted } from './utils/sound'
import { shuffle } from './utils/shuffle'

type View = 'start' | 'quiz' | 'results' | 'stats'

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
  const filteredQuestions = useMemo(() => quiz.questions.filter((question) =>
    (!selectedThemes.length || selectedThemes.includes(question.theme)) && (!difficulty || question.difficulty === difficulty)), [quiz, selectedThemes, difficulty])

  const toggleTheme = (themeId: string) => setSelectedThemes((previous) =>
    previous.includes(themeId) ? previous.filter((id) => id !== themeId) : [...previous, themeId])

  const loadFile = async (file?: File) => {
    if (!file) return
    try {
      setQuiz(parseQuiz(JSON.parse(await file.text())))
      setSelectedThemes([]); setDifficulty(''); setSessionQuestions([]); setView('start'); setFileError('')
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

  const backToStart = () => {
    setAnswers({})
    setSessionQuestions([])
    setElapsedSeconds(0)
    setView('start')
  }

  const toggleSound = () => {
    setSoundMuted(!muted)
    setMuted(!muted)
  }

  return <main className="app-shell">
    <header><div><p className="eyebrow">OLIVER QUIZ</p><h1>{quiz.metadata.title}</h1><p>par {quiz.metadata.author}</p></div><div className="header-actions"><button type="button" className="secondary" onClick={toggleSound} aria-label={muted ? 'Activer le son' : 'Couper le son'}>{muted ? '🔇' : '🔊'}</button>{view === 'start' && <button type="button" className="secondary" onClick={() => setView('stats')}>📊 Statistiques</button>}{view === 'start' && <label className="file-input">Importer un JSON<input type="file" accept="application/json,.json" onChange={(event) => loadFile(event.target.files?.[0])} /></label>}<button type="button" className="secondary" onClick={onLogout}>Se déconnecter</button></div></header>
    {fileError && <p className="alert" role="alert">{fileError}</p>}
    {view === 'start' && <section className="start-page"><FilterPanel themes={quiz.themes} selectedThemes={selectedThemes} difficulty={difficulty} onThemeToggle={toggleTheme} onDifficultyChange={setDifficulty} /><label className="question-count">Nombre de questions<select value={questionCount} onChange={(event) => { playClick(); setQuestionCount(Number(event.target.value)) }}>{questionCounts.map((count) => <option key={count} value={count} disabled={count > filteredQuestions.length}>{count} {count === 1 ? 'question' : 'questions'}{count > filteredQuestions.length ? ' (indisponible)' : ''}</option>)}<option value={filteredQuestions.length}>Toutes les questions ({filteredQuestions.length})</option></select></label><p>{filteredQuestions.length} question{filteredQuestions.length > 1 ? 's' : ''} disponible{filteredQuestions.length > 1 ? 's' : ''} — {Math.min(questionCount, filteredQuestions.length)} seront tirées aléatoirement.</p><button type="button" onClick={startQuiz} disabled={!filteredQuestions.length}>Démarrer le quiz</button></section>}
    {view === 'quiz' && <QuizPage quiz={quiz} questions={sessionQuestions} onFinish={(nextAnswers, duration) => { setAnswers(nextAnswers); setElapsedSeconds(duration); setView('results') }} onCancel={backToStart} />}
    {view === 'results' && <ResultPage questions={sessionQuestions} answers={answers} themes={quiz.themes} elapsedSeconds={elapsedSeconds} onRestart={backToStart} />}
    {view === 'stats' && <StatsPage quiz={quiz} onBack={() => setView('start')} />}
  </main>
}
