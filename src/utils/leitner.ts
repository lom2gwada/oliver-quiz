import type { AnswersByQuestion, Question } from '../types/quiz'
import { isCorrect } from '../components/ResultPage'
import { shuffle } from './shuffle'
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

/** Prépare l'enregistrement de la progression Leitner d'une partie : chaque question jouée avance d'une case dans sa
 * boîte (ou retombe en boîte 1 si ratée). Renvoie une tâche rejouable (voir `runSaveJobs`) : la lecture des boîtes
 * actuelles et le calcul des nouvelles ne se font qu'une fois, puis l'écriture — un état absolu (boîte + échéance) —
 * est simplement renvoyée à l'identique. Rejouer toute la chaîne après une réponse perdue ferait avancer une seconde
 * fois les cartes dont la première écriture avait pourtant réussi. Lève l'erreur : l'appelant relance puis prévient. */
export function createQuestionProgressJob(quizId: string, questions: Question[], answers: AnswersByQuestion): () => Promise<void> {
  let payloads: { quiz_id: string; question_id: string; box: number; due_at: string; updated_at: string }[] | null = null
  return async () => {
    if (!payloads) {
      const previous = await fetchQuestionProgress(quizId)
      const previousBox = new Map(previous.map((row) => [row.question_id, row.box]))
      const updatedAt = new Date().toISOString()
      payloads = questions.map((question) => {
        const box = nextBox(previousBox.get(question.id) ?? 1, isCorrect(question, answers[question.id]))
        return { quiz_id: quizId, question_id: question.id, box, due_at: dueAtFor(box), updated_at: updatedAt }
      })
    }
    const { error } = await supabase.from('question_progress').upsert(payloads, { onConflict: 'user_id,quiz_id,question_id' })
    if (error) throw error
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

/** Compose une session de révision de `count` questions à partir des cartes échues (déjà triées par priorité, voir
 * `computeDueQuestions`) : la moitié (arrondie au-dessus) vient des cartes les plus fragiles — les ratées d'abord,
 * pour qu'elles reviennent vite —, le reste est tiré au hasard parmi les autres cartes échues, pour que tout
 * l'arriéré finisse par ressortir (sinon, tant qu'il y a plus de `count` cartes en boîte 1, les cartes des boîtes
 * suivantes n'étaient jamais proposées). L'ordre de la session est mélangé : plus de séquence apprise par cœur. */
export function selectReviewQuestions(due: { question: Question; box: number }[], count: number): Question[] {
  const size = Math.min(count, due.length)
  const priorityCount = Math.ceil(size / 2)
  const priority = due.slice(0, priorityCount)
  const randomPart = shuffle(due.slice(priorityCount)).slice(0, size - priorityCount)
  return shuffle([...priority, ...randomPart]).map((card) => card.question)
}
