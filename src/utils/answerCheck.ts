import type { AnswersByQuestion, Question } from '../types/quiz'
import type { TranslationKey } from '../i18n'
import { translate } from '../i18n'
import { matchesExpected } from '@engine/utils/answerMatch'

/** Corriger une réponse et la mettre en mots : partagé par les pages de résultat, l'historique, les liens invités et la révision
 * espacée. Les composants (`ResultPage`…) les réexportent, pour ne pas toucher à leurs importateurs. */

export type TFunction = (key: TranslationKey, ...args: unknown[]) => string
/** Traducteur français par défaut : `userAnswer`/`correctAnswer` sont appelées par des écrans pas encore
 * migrés (ex. `QuizContentPage.tsx`) qui ne passent pas de `t` — ce défaut préserve exactement le
 * comportement (et les chaînes) d'avant l'i18n pour ces appelants, sans les forcer à être touchés ici. */
const defaultT: TFunction = (key, ...args) => translate('fr', key, ...args)

const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((item) => right.includes(item))

export function isCorrect(question: Question, answer: AnswersByQuestion[string] | undefined): boolean {
  if (question.type === 'text' || question.type === 'cloze') {
    if (typeof answer !== 'string') return false
    // Comparaison du moteur commun : accents, majuscules, tirets / apostrophes, article de tête et faute de frappe sur un
    // mot long sont tolérés (voir `matchesExpected`) ; `caseSensitive` la rend stricte.
    return matchesExpected(answer, question.content.expectedAnswers, question.content.caseSensitive)
  }
  if (question.type === 'numeric') {
    if (typeof answer !== 'string' || answer === '') return false
    const value = Number(answer)
    return Number.isFinite(value) && Math.abs(value - question.content.target) <= question.content.tolerance
  }
  if (!Array.isArray(answer)) return false
  if (question.type === 'ordering') return answer.every((id, index) => id === question.content.correctOrder[index]) && answer.length === question.content.correctOrder.length
  if (question.type === 'boolean') return answer[0] === String(question.content.isTrue)
  if (question.type === 'matching') {
    const expected = question.content.correctPairs
    const given: Record<string, string> = {}
    answer.forEach((token) => {
      const [left, right] = token.split(':')
      if (left && right) given[left] = right
    })
    const keys = Object.keys(expected)
    return keys.length === Object.keys(given).length && keys.every((left) => given[left] === expected[left])
  }
  return sameIds(answer, question.content.answers.filter((item) => item.isCorrect).map((item) => item.id))
}

export function userAnswer(question: Question, answer: AnswersByQuestion[string] | undefined, t: TFunction = defaultT): string {
  if (question.type === 'text' || question.type === 'cloze') return typeof answer === 'string' && answer.trim() ? answer : t('quiz.noAnswer')
  if (question.type === 'numeric') {
    if (typeof answer !== 'string' || answer === '') return t('quiz.noAnswer')
    const suffix = question.content.unit ? ` ${question.content.unit}` : ''
    return `${answer}${suffix}`
  }
  if (!Array.isArray(answer) || !answer.length) return t('quiz.noAnswer')
  if (question.type === 'ordering') return answer.map((id) => question.content.items.find((item) => item.id === id)?.label).join(' → ')
  if (question.type === 'boolean') return answer[0] === 'true' ? t('quiz.true') : t('quiz.false')
  if (question.type === 'matching') {
    const pairs = answer.map((token) => {
      const [leftId, rightId] = token.split(':')
      const left = question.content.left.find((item) => item.id === leftId)
      const right = question.content.right.find((item) => item.id === rightId)
      return left && right ? `${left.label} → ${right.label}` : null
    }).filter(Boolean)
    return pairs.length ? pairs.join(', ') : t('quiz.noAnswer')
  }
  return answer.map((id) => question.content.answers.find((item) => item.id === id)?.label).join(', ')
}

export function correctAnswer(question: Question, t: TFunction = defaultT): string {
  if (question.type === 'text' || question.type === 'cloze') return question.content.expectedAnswers.join(t('quiz.orSeparator'))
  if (question.type === 'numeric') {
    const { target, tolerance, unit } = question.content
    const suffix = unit ? ` ${unit}` : ''
    return tolerance > 0 ? `${target}${suffix} (± ${tolerance}${suffix})` : `${target}${suffix}`
  }
  if (question.type === 'ordering') return question.content.correctOrder.map((id) => question.content.items.find((item) => item.id === id)?.label).join(' → ')
  if (question.type === 'boolean') return question.content.isTrue ? t('quiz.true') : t('quiz.false')
  if (question.type === 'matching') {
    return question.content.left.map((left) => {
      const right = question.content.right.find((item) => item.id === question.content.correctPairs[left.id])
      return `${left.label} → ${right?.label ?? '?'}`
    }).join(', ')
  }
  return question.content.answers.filter((answer) => answer.isCorrect).map((answer) => answer.label).join(', ')
}
