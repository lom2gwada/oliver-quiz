import { describe, expect, it } from 'vitest'

/** Garde-fou : tout composant qui présente une question à jouer doit passer par `withShuffledAnswers`.
 * Les quiz stockent presque toujours la bonne réponse d'un QCM en première position ; un parcours (nouveau mode de
 * jeu, nouvelle page) qui afficherait les réponses telles quelles ferait de la première option la bonne. */
const sources = import.meta.glob<string>('./*.tsx', { query: '?raw', import: 'default', eager: true })

/** Composants qui rendent une question sans devoir la mélanger : le rendu lui-même, et la relecture d'une partie
 * terminée, qui doit montrer la question dans l'ordre où elle a été jouée. */
const EXEMPT = new Set(['QuestionBody.tsx', 'QuestionReplay.tsx'])

const rendersAQuestion = (source: string) => /<QuestionBody\b|<QuestionRenderer\b/.test(source)

/** Appelle réellement le mélange : un simple import, ou la définition de la fonction, ne suffit pas. */
const usesShuffle = (source: string) => source
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"]/g, '')
  .replace(/function withShuffledAnswers/g, '')
  .includes('withShuffledAnswers')

const files = Object.entries(sources).map(([path, source]) => ({ file: path.replace('./', ''), source }))
const guarded = files.filter(({ file, source }) => !EXEMPT.has(file) && rendersAQuestion(source))

describe('answer shuffling guard', () => {
  it('finds the play pages it is supposed to guard', () => {
    expect(guarded.map(({ file }) => file)).toEqual(expect.arrayContaining(['QuizPage.tsx', 'StreakQuizPage.tsx', 'TimedQuizPage.tsx', 'GuestQuizPage.tsx', 'QuestionPreview.tsx']))
  })

  it('makes every component that renders a question shuffle its answers', () => {
    const missing = guarded.filter(({ source }) => !usesShuffle(source)).map(({ file }) => file)
    expect(missing).toEqual([])
  })
})
