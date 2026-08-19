import { useMemo, useState } from 'react'
import sampleQuiz from './data/sample-quiz.json'
import { FilterPanel } from './components/FilterPanel'
import { QuizPage } from './components/QuizPage'
import { ResultPage } from './components/ResultPage'
import { StatsPage } from './components/StatsPage'
import type { AnswersByQuestion, Difficulty, Quiz } from './types/quiz'
import { parseQuiz } from './utils/quizValidation'

type View = 'start' | 'quiz' | 'results' | 'stats'

const initialQuiz = parseQuiz(sampleQuiz)
const questionCounts = [5, 10, 20, 30, 50]

/** Mélange Fisher-Yates : une session garde son ordre, chaque nouvelle session change. */
function pickRandomQuestions<T>(questions: T[], count: number): T[] {
  const shuffled = [...questions]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export default function App() {
  const [quiz, setQuiz] = useState<Quiz>(initialQuiz)
  const [theme, setTheme] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('')
  const [view, setView] = useState<View>('start')
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [fileError, setFileError] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [sessionQuestions, setSessionQuestions] = useState<Quiz['questions']>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const filteredQuestions = useMemo(() => quiz.questions.filter((question) =>
    (!theme || question.theme === theme) && (!difficulty || question.difficulty === difficulty)), [quiz, theme, difficulty])

  const loadFile = async (file?: File) => {
    if (!file) return
    try {
      setQuiz(parseQuiz(JSON.parse(await file.text())))
      setTheme(''); setDifficulty(''); setSessionQuestions([]); setView('start'); setFileError('')
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Fichier JSON invalide.')
    }
  }

  const startQuiz = () => {
    setAnswers({})
    setSessionQuestions(pickRandomQuestions(filteredQuestions, questionCount))
    setView('quiz')
  }

  return <main className="app-shell">
    <header><div><p className="eyebrow">QUIZ TECHNIQUE</p><h1>{quiz.metadata.title}</h1><p>par {quiz.metadata.author}</p></div><div className="header-actions">{view !== 'stats' && <button type="button" className="secondary" onClick={() => setView('stats')}>📊 Statistiques</button>}<label className="file-input">Importer un JSON<input type="file" accept="application/json,.json" onChange={(event) => loadFile(event.target.files?.[0])} /></label></div></header>
    {fileError && <p className="alert" role="alert">{fileError}</p>}
    {view === 'start' && <section className="start-page"><FilterPanel themes={quiz.themes} theme={theme} difficulty={difficulty} onThemeChange={setTheme} onDifficultyChange={setDifficulty} /><label className="question-count">Nombre de questions<select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}>{questionCounts.map((count) => <option key={count} value={count} disabled={count > filteredQuestions.length}>{count} {count === 1 ? 'question' : 'questions'}{count > filteredQuestions.length ? ' (indisponible)' : ''}</option>)}<option value={filteredQuestions.length}>Toutes les questions ({filteredQuestions.length})</option></select></label><p>{filteredQuestions.length} question{filteredQuestions.length > 1 ? 's' : ''} disponible{filteredQuestions.length > 1 ? 's' : ''} — {Math.min(questionCount, filteredQuestions.length)} seront tirées aléatoirement.</p><button type="button" onClick={startQuiz} disabled={!filteredQuestions.length}>Démarrer le quiz</button></section>}
    {view === 'quiz' && <QuizPage quiz={quiz} questions={sessionQuestions} onFinish={(nextAnswers, duration) => { setAnswers(nextAnswers); setElapsedSeconds(duration); setView('results') }} />}
    {view === 'results' && <ResultPage questions={sessionQuestions} answers={answers} themes={quiz.themes} elapsedSeconds={elapsedSeconds} onRestart={() => { setAnswers({}); setSessionQuestions([]); setElapsedSeconds(0); setView('start') }} />}
    {view === 'stats' && <StatsPage quiz={quiz} onBack={() => setView('start')} />}
  </main>
}
