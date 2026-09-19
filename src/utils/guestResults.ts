import type { GuestResultRow } from '../types/guestLink'
import type { Question } from '../types/quiz'
import type { TranslationKey } from '../i18n'
import { isCorrect, userAnswer } from '../components/ResultPage'

type TFunction = (key: TranslationKey, ...args: unknown[]) => string

export interface GuestResultsSummary {
  count: number
  /** Moyenne des scores (0-100) ; `null` en mode sondage, où aucune réponse n'est notée. */
  averageScore: number | null
  averageSeconds: number
}

export function summarizeGuestResults(results: GuestResultRow[]): GuestResultsSummary {
  const scores = results.map((result) => result.score).filter((score): score is number => score !== null)
  return {
    count: results.length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    averageSeconds: results.length ? Math.round(results.reduce((sum, result) => sum + result.elapsed_seconds, 0) / results.length) : 0,
  }
}

export interface QuestionCorrectness {
  question: Question
  correct: number
  total: number
}

/** Mode test : pour chaque question du quiz, combien de répondants l'ont réussie. Recalculé à la volée depuis les
 * réponses brutes (comme `computeMissedQuestions`) — une question modifiée depuis se juge donc sur sa version actuelle. */
export function computeQuestionCorrectness(results: GuestResultRow[], questions: Question[]): QuestionCorrectness[] {
  return questions.map((question) => ({
    question,
    correct: results.filter((result) => isCorrect(question, result.answers[question.id])).length,
    total: results.length,
  }))
}

export interface AnswerTally {
  label: string
  count: number
}

const MAX_FREE_ANSWERS = 5

/** Mode sondage : répartition des réponses à une question. Les questions à choix (QCM, code) listent toutes leurs
 * options dans l'ordre d'origine, même celles jamais choisies ; les autres types (texte, nombre, ordre, association,
 * vrai/faux…) comptent les réponses identiques et gardent les plus fréquentes. Les non-réponses sont comptées à part. */
export function tallyAnswers(question: Question, results: GuestResultRow[], t: TFunction): AnswerTally[] {
  if (question.type === 'qcm' || question.type === 'code') {
    const counts = new Map<string, number>()
    let unanswered = 0
    results.forEach((result) => {
      const answer = result.answers[question.id]
      if (!Array.isArray(answer) || !answer.length) { unanswered += 1; return }
      answer.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1))
    })
    const tallies = question.content.answers.map((option) => ({ label: option.label, count: counts.get(option.id) ?? 0 }))
    return unanswered ? [...tallies, { label: t('quiz.noAnswer'), count: unanswered }] : tallies
  }
  const counts = new Map<string, number>()
  results.forEach((result) => {
    const label = userAnswer(question, result.answers[question.id], t)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, MAX_FREE_ANSWERS)
}
