import type { Language } from '../i18n/types'

const TEXTS = {
  fr: {
    title: 'Mon quiz', author: 'Mon nom', description: 'Modèle de quiz : une question de chaque type, à remplacer par les vôtres.', theme: 'Général',
    qcm: 'Quelle est la capitale de la France ?', qcmAnswers: ['Paris', 'Lyon', 'Marseille'], qcmExplanation: 'Paris est la capitale de la France.',
    code: 'Qu’affiche ce programme ?', codeExplanation: 'La boucle additionne 1 + 2 + 3.', codeAnswers: ['6', '3', '123'],
    text: 'Quel est le plus grand océan du monde ?', textAnswers: ['Pacifique', 'Océan Pacifique'], textExplanation: "L'océan Pacifique couvre environ un tiers de la planète.",
    ordering: 'Classez ces planètes de la plus proche à la plus éloignée du Soleil.', orderingItems: ['Mercure', 'Vénus', 'Terre'], orderingExplanation: 'Mercure, Vénus puis la Terre.',
    boolean: 'La Terre tourne autour du Soleil.', booleanExplanation: 'Une révolution complète dure environ 365 jours.',
    cloze: 'La capitale de l’Italie est ___.', clozeAnswers: ['Rome'], clozeExplanation: 'Rome est la capitale de l’Italie.',
    matching: 'Associez chaque pays à sa capitale.', matchingLeft: ['France', 'Italie'], matchingRight: ['Paris', 'Rome'], matchingExplanation: 'Paris pour la France, Rome pour l’Italie.',
    numeric: 'En quelle année a eu lieu la prise de la Bastille ?', numericUnit: '', numericExplanation: 'La prise de la Bastille date de 1789.',
  },
  en: {
    title: 'My quiz', author: 'My name', description: 'Quiz template: one question of each type, to be replaced with your own.', theme: 'General',
    qcm: 'What is the capital of France?', qcmAnswers: ['Paris', 'Lyon', 'Marseille'], qcmExplanation: 'Paris is the capital of France.',
    code: 'What does this program print?', codeExplanation: 'The loop adds 1 + 2 + 3.', codeAnswers: ['6', '3', '123'],
    text: 'What is the largest ocean in the world?', textAnswers: ['Pacific', 'Pacific Ocean'], textExplanation: 'The Pacific Ocean covers about a third of the planet.',
    ordering: 'Sort these planets from the closest to the farthest from the Sun.', orderingItems: ['Mercury', 'Venus', 'Earth'], orderingExplanation: 'Mercury, Venus, then Earth.',
    boolean: 'The Earth orbits the Sun.', booleanExplanation: 'A full revolution takes about 365 days.',
    cloze: 'The capital of Italy is ___.', clozeAnswers: ['Rome'], clozeExplanation: 'Rome is the capital of Italy.',
    matching: 'Match each country with its capital.', matchingLeft: ['France', 'Italy'], matchingRight: ['Paris', 'Rome'], matchingExplanation: 'Paris for France, Rome for Italy.',
    numeric: 'In which year was the Bastille stormed?', numericUnit: '', numericExplanation: 'The storming of the Bastille took place in 1789.',
  },
} as const

/** Un quiz minimal et valide, avec une question de chaque type, au format d'import (`themes`, `theme`) : de quoi partir d'un
 * fichier qui passe la validation du premier coup. `today` : date de création (ISO), injectable pour les tests. */
export function buildQuizTemplate(language: Language, today = new Date().toISOString().slice(0, 10)): Record<string, unknown> {
  const x = TEXTS[language]
  const common = { theme: 'general', difficulty: 'easy', tags: [] as string[], points: 1 }
  const choice = (labels: readonly string[]) => labels.map((label, index) => ({ id: String.fromCharCode(97 + index), label, isCorrect: index === 0 }))
  return {
    version: '1.0',
    metadata: { title: x.title, author: x.author, createdAt: today, description: x.description, language },
    themes: [{ id: 'general', label: x.theme }],
    questions: [
      { id: 'qcm-1', type: 'qcm', ...common, question: x.qcm, explanation: x.qcmExplanation, content: { multiple: false, answers: choice(x.qcmAnswers) } },
      { id: 'code-1', type: 'code', ...common, question: x.code, explanation: x.codeExplanation, content: { language: 'javascript', snippet: 'let total = 0\nfor (let i = 1; i <= 3; i++) total += i\nconsole.log(total)', multiple: false, answers: choice(x.codeAnswers) } },
      { id: 'text-1', type: 'text', ...common, question: x.text, explanation: x.textExplanation, content: { expectedAnswers: [...x.textAnswers], caseSensitive: false } },
      { id: 'ordering-1', type: 'ordering', ...common, question: x.ordering, explanation: x.orderingExplanation, content: { items: x.orderingItems.map((label, index) => ({ id: `p${index + 1}`, label })), correctOrder: ['p1', 'p2', 'p3'] } },
      { id: 'boolean-1', type: 'boolean', ...common, question: x.boolean, explanation: x.booleanExplanation, content: { isTrue: true } },
      { id: 'cloze-1', type: 'cloze', ...common, question: x.cloze, explanation: x.clozeExplanation, content: { expectedAnswers: [...x.clozeAnswers], caseSensitive: false } },
      { id: 'matching-1', type: 'matching', ...common, question: x.matching, explanation: x.matchingExplanation, content: { left: x.matchingLeft.map((label, index) => ({ id: `l${index + 1}`, label })), right: x.matchingRight.map((label, index) => ({ id: `r${index + 1}`, label })), correctPairs: { l1: 'r1', l2: 'r2' } } },
      { id: 'numeric-1', type: 'numeric', ...common, question: x.numeric, explanation: x.numericExplanation, content: { min: 1700, max: 1900, step: 1, target: 1789, tolerance: 0 } },
    ],
  }
}

/** Le nom du fichier téléchargé. */
export const QUIZ_TEMPLATE_FILENAME = 'modele-quiz.json'
