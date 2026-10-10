import type { AnswersByQuestion, Question } from '../types/quiz'
import { isCorrect } from '../components/ResultPage'
import { retryWithBackoff } from './retry'
import { supabase } from './supabase'

export interface QuestionProgressRow {
  quiz_id: string
  question_id: string
  box: number
  due_at: string
}

export const MAX_BOX = 5

/** Boîte 1 = neuve ou ratée, échéance immédiate. Les boîtes suivantes n'ont d'échéance qu'après une bonne
 * réponse : l'intervalle avant la prochaine révision grandit à chaque passage, une mauvaise réponse renvoie
 * toujours en boîte 1 plutôt que d'un seul cran en arrière. */
const BOX_INTERVAL_DAYS: Record<number, number> = { 2: 1, 3: 3, 4: 7, 5: 21 }

export function nextBox(currentBox: number, correct: boolean): number {
  return correct ? Math.min(currentBox + 1, MAX_BOX) : 1
}

function dueAtFor(box: number): string {
  const due = new Date()
  due.setDate(due.getDate() + (BOX_INTERVAL_DAYS[box] ?? 0))
  return due.toISOString()
}

export async function fetchQuestionProgress(quizId: string): Promise<QuestionProgressRow[]> {
  const { data, error } = await supabase.from('question_progress').select('quiz_id, question_id, box, due_at').eq('quiz_id', quizId)
  if (error) throw error
  return data ?? []
}

/** Fait avancer chaque question jouée d'une case dans sa boîte Leitner (ou la renvoie en boîte 1 si ratée).
 * Best-effort, comme le reste de l'enregistrement d'historique : une partie non enregistrée ne doit jamais
 * empêcher l'utilisateur de voir son résultat. */
export async function recordQuestionProgress(quizId: string, questions: Question[], answers: AnswersByQuestion): Promise<void> {
  try {
    // Lecture et écriture reprises séparément : la lecture peut être rejouée sans risque, et l'écriture pose un
    // état absolu (boîte + échéance déjà calculées). Rejouer toute la chaîne après une réponse perdue ferait
    // avancer une seconde fois les cartes dont la première écriture avait pourtant réussi.
    const previous = await retryWithBackoff(() => fetchQuestionProgress(quizId), { delaysMs: [800, 2400] })
    const previousBox = new Map(previous.map((row) => [row.question_id, row.box]))
    const updatedAt = new Date().toISOString()
    const payloads = questions.map((question) => {
      const box = nextBox(previousBox.get(question.id) ?? 1, isCorrect(question, answers[question.id]))
      return { quiz_id: quizId, question_id: question.id, box, due_at: dueAtFor(box), updated_at: updatedAt }
    })
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('question_progress').upsert(payloads, { onConflict: 'user_id,quiz_id,question_id' })
      if (error) throw error
    }, { delaysMs: [800, 2400] })
  } catch (error) {
    console.error("Impossible d'enregistrer la progression Leitner.", error)
  }
}

/** Cartes dont l'échéance est passée, des plus fragiles (boîte basse) aux plus solides — ignore les lignes de
 * progression dont la question n'existe plus dans le quiz (question supprimée depuis par un admin). */
export function computeDueQuestions(progress: QuestionProgressRow[], questions: Question[]): { question: Question; box: number }[] {
  const now = Date.now()
  const byId = new Map(questions.map((question) => [question.id, question]))
  return progress
    .filter((row) => byId.has(row.question_id) && new Date(row.due_at).getTime() <= now)
    .sort((a, b) => a.box - b.box || a.due_at.localeCompare(b.due_at))
    .map((row) => ({ question: byId.get(row.question_id)!, box: row.box }))
}
