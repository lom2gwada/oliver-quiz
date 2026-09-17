import type { Difficulty, Question, QuestionType } from '../types/quiz'

/**
 * Barème par défaut (secondes), utilisé quand une question ne précise pas `timeLimitSeconds`.
 * Le facteur dominant est le type de question — construire un glisser-déposer ou un appariement
 * prend nettement plus de temps que cliquer une réponse QCM — la difficulté n'affine qu'à l'intérieur
 * de chaque type.
 */
const DEFAULT_TIME_LIMITS: Record<QuestionType, Record<Difficulty, number>> = {
  boolean: { easy: 8, medium: 10, hard: 12 },
  qcm: { easy: 10, medium: 15, hard: 20 },
  numeric: { easy: 10, medium: 15, hard: 20 },
  cloze: { easy: 12, medium: 18, hard: 22 },
  text: { easy: 15, medium: 20, hard: 25 },
  code: { easy: 20, medium: 30, hard: 40 },
  ordering: { easy: 20, medium: 30, hard: 40 },
  matching: { easy: 25, medium: 35, hard: 45 },
}

/** Le temps limite effectif d'une question : celui qu'elle précise elle-même, sinon le barème par défaut. */
export function questionTimeLimit(question: Question): number {
  return question.timeLimitSeconds ?? DEFAULT_TIME_LIMITS[question.type][question.difficulty]
}

export type TimerUrgency = 'normal' | 'warning' | 'danger'

/** Urgence visuelle du chrono par question, en proportion du temps limite plutôt qu'en secondes absolues —
 * un seuil en secondes fixes serait injuste entre une question de 8s et une de 45s. */
export function questionTimerUrgency(remaining: number, limit: number): TimerUrgency {
  if (remaining <= limit * 0.2) return 'danger'
  if (remaining <= limit * 0.5) return 'warning'
  return 'normal'
}
