import type { Question, UserAnswer } from '../types/quiz'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionImage } from './QuestionImage'
import { QuestionRenderer } from './QuestionRenderer'
import { QuestionTable } from './QuestionTable'

/** Une question telle que le joueur la voit : média, énoncé, puis zone de réponse. Partagé par tous les parcours
 * de jeu et par l'aperçu "vue joueur" de l'admin, pour qu'ils ne divergent jamais. Les cloze portent leur
 * énoncé dans la zone de saisie elle-même, d'où l'absence de titre pour ce type. Les appelants passent une
 * `key` propre à la question pour remonter le composant à chaque changement (les champs se réinitialisent). */
export function QuestionBody({ question, answer, onChange, onEnter }: { question: Question; answer?: UserAnswer; onChange: (answer: UserAnswer) => void; onEnter?: () => void }) {
  return <div className="question-body">
    {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
    {question.diagram && <MermaidDiagram chart={question.diagram} />}
    {question.table && <QuestionTable table={question.table} />}
    {question.type !== 'cloze' && <h2>{question.question}</h2>}
    <QuestionRenderer question={question} answer={answer} onChange={onChange} onEnter={onEnter} />
  </div>
}
