import { describe, expect, it } from 'vitest'

/** Garde-fou : tout parcours de jeu où « Suivante » (ou la touche Entrée) fait passer à la question d'après doit
 * passer par `useAdvanceGuard`, sinon un double clic fait sauter une question jamais vue — elle apparaît ensuite au
 * corrigé sans réponse. Un parcours est reconnu à ce qu'il rend `<QuestionBody ... onEnter=...>`. */
const sources = import.meta.glob<string>('./*.tsx', { query: '?raw', import: 'default', eager: true })

/** Appelle réellement le hook : un simple import ne suffit pas. */
const usesGuard = (source: string) => source.replace(/import[\s\S]*?from\s+['"][^'"]+['"]/g, '').includes('useAdvanceGuard(')

/** L'aperçu joueur de l'admin utilise Entrée pour vérifier la réponse, pas pour passer à la question suivante. */
const EXEMPT = new Set(['QuestionPreview.tsx'])

const playPages = Object.entries(sources)
  .map(([path, source]) => ({ file: path.replace('./', ''), source }))
  .filter(({ file, source }) => !EXEMPT.has(file) && /<QuestionBody\b[\s\S]{0,500}?\bonEnter=/.test(source))

describe('advance guard', () => {
  it('finds the play pages it is supposed to guard', () => {
    expect(playPages.map(({ file }) => file)).toEqual(expect.arrayContaining(['QuizPage.tsx', 'StreakQuizPage.tsx', 'TimedQuizPage.tsx', 'GuestQuizPage.tsx']))
  })

  it('makes every play page ignore a "next" that follows the previous one too closely', () => {
    const missing = playPages.filter(({ source }) => !usesGuard(source)).map(({ file }) => file)
    expect(missing).toEqual([])
  })
})
