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

/** Vitesse de lecture retenue pour le temps de lecture ajouté au-delà du gabarit "question courte" — plus
 * lente qu'une lecture silencieuse pure, pour laisser le temps de comprendre et décider, pas seulement de
 * parcourir des yeux. */
const READING_CHARS_PER_SECOND = 14

/** Longueur "typique" de question déjà couverte par le barème ci-dessus (calibrée sur les questions courtes du
 * quiz d'exemple) — au-delà, on ajoute du temps de lecture proportionnel à l'excédent plutôt que de tout
 * recalibrer sur un texte plus long, ce qui pénaliserait les questions déjà courtes. Un quiz volumineux
 * généré en masse (ex. un gros QCM technique) a des énoncés et des options nettement plus longs qu'un quiz
 * écrit à la main comme le quiz d'exemple, d'où l'écart signalé par l'utilisateur entre les deux. */
const TYPICAL_LENGTH: Partial<Record<QuestionType, number>> = { qcm: 90, code: 120, ordering: 130, matching: 150 }
const DEFAULT_TYPICAL_LENGTH = 80

/** Tout le texte à lire pour répondre — pas seulement l'énoncé : les options d'un QCM/code (et son extrait de
 * code), les éléments à ordonner, ou les deux colonnes d'un appariement. */
function readableLength(question: Question): number {
  const base = question.question.length
  if (question.type === 'qcm') return base + question.content.answers.reduce((sum, answer) => sum + answer.label.length, 0)
  if (question.type === 'code') return base + question.content.snippet.length + question.content.answers.reduce((sum, answer) => sum + answer.label.length, 0)
  if (question.type === 'ordering') return base + question.content.items.reduce((sum, item) => sum + item.label.length, 0)
  if (question.type === 'matching') return base + [...question.content.left, ...question.content.right].reduce((sum, item) => sum + item.label.length, 0)
  return base
}

/** Le temps limite effectif d'une question : celui qu'elle précise elle-même (prioritaire), sinon le barème
 * par défaut augmenté du temps de lecture qu'un énoncé/des options plus longs que la moyenne demandent en plus. */
export function questionTimeLimit(question: Question): number {
  if (question.timeLimitSeconds) return question.timeLimitSeconds
  const barème = DEFAULT_TIME_LIMITS[question.type][question.difficulty]
  const extraChars = Math.max(0, readableLength(question) - (TYPICAL_LENGTH[question.type] ?? DEFAULT_TYPICAL_LENGTH))
  return barème + Math.ceil(extraChars / READING_CHARS_PER_SECOND)
}

export type TimerUrgency = 'normal' | 'warning' | 'danger'

/** Urgence visuelle du chrono par question, en proportion du temps limite plutôt qu'en secondes absolues —
 * un seuil en secondes fixes serait injuste entre une question de 8s et une de 45s. */
export function questionTimerUrgency(remaining: number, limit: number): TimerUrgency {
  if (remaining <= limit * 0.2) return 'danger'
  if (remaining <= limit * 0.5) return 'warning'
  return 'normal'
}
