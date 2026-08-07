import type { AnswersByQuestion, Question } from '../types/quiz'

const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((item) => right.includes(item))

export function isCorrect(question: Question, answer: AnswersByQuestion[string]): boolean {
  if (question.type === 'text') {
    if (typeof answer !== 'string') return false
    const normalize = (value: string) => question.content.caseSensitive ? value.trim() : value.trim().toLocaleLowerCase()
    return question.content.expectedAnswers.map(normalize).includes(normalize(answer))
  }
  if (!Array.isArray(answer)) return false
  if (question.type === 'ordering') return answer.every((id, index) => id === question.content.correctOrder[index]) && answer.length === question.content.correctOrder.length
  return sameIds(answer, question.content.answers.filter((item) => item.isCorrect).map((item) => item.id))
}

export function ResultPage({ questions, answers, onRestart }: { questions: Question[]; answers: AnswersByQuestion; onRestart: () => void }) {
  const earned = questions.filter((question) => isCorrect(question, answers[question.id])).reduce((total, question) => total + question.points, 0)
  const total = questions.reduce((sum, question) => sum + question.points, 0)
  const score = total ? Math.round((earned / total) * 100) : 0
  return <section className="results">
    <div className="score"><p>Votre score</p><strong>{score}%</strong><span>{earned} / {total} points</span></div>
    <button type="button" onClick={onRestart}>Recommencer</button>
    <div className="corrections">{questions.map((question) => {
      const correct = isCorrect(question, answers[question.id])
      return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={question.id}>
        <h3>{correct ? '✓ Bonne réponse' : '✗ Réponse incorrecte'} — {question.question}</h3>
        {!correct && <p><strong>Bonne réponse :</strong> {correctAnswer(question)}</p>}
        <p>{question.explanation}</p>
      </article>
    })}</div>
  </section>
}

function correctAnswer(question: Question): string {
  if (question.type === 'text') return question.content.expectedAnswers.join(' ou ')
  if (question.type === 'ordering') return question.content.correctOrder.map((id) => question.content.items.find((item) => item.id === id)?.label).join(' → ')
  return question.content.answers.filter((answer) => answer.isCorrect).map((answer) => answer.label).join(', ')
}
