import type { Quiz, Question } from '../types/quiz'
import { parseQuizImage, parseQuizLinks } from './quizMeta'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/** Refuse le fichier en disant où : `chemin : problème`, par exemple `questions[3].points : nombre positif ou nul attendu.` */
function fail(path: string, problem: string): never {
  throw new Error(`${path} : ${problem}`)
}

/** Toutes les lignes (et l'en-tête, si présent) doivent avoir le même nombre de colonnes. */
function checkTable(value: unknown, path: string, label: string): void {
  function bad(where: string, problem: string): never { return fail(where, `${problem}${label}`) }
  if (!isRecord(value) || !Array.isArray(value.rows) || !value.rows.length) bad(path, 'objet { headers?, rows } attendu, avec au moins une ligne.')
  if (value.headers !== undefined && !hasStrings(value.headers)) bad(`${path}.headers`, 'liste de textes attendue.')
  const rows = value.rows as unknown[]
  rows.forEach((row, index) => { if (!hasStrings(row)) bad(`${path}.rows[${index}]`, 'liste de textes attendue.') })
  const columnCount = (value.headers as string[] | undefined)?.length ?? (rows[0] as string[]).length
  rows.forEach((row, index) => { if ((row as string[]).length !== columnCount) bad(`${path}.rows[${index}]`, `${columnCount} colonnes attendues, ${(row as string[]).length} trouvées.`) })
}

/** Valide le contrat JSON avant de l'utiliser dans l'application. Chaque refus nomme le champ en cause. */
export function parseQuiz(value: unknown): Quiz {
  if (!isRecord(value)) fail('Racine', 'un objet JSON est attendu.')
  if (typeof value.version !== 'string') fail('version', 'texte attendu (ex. "1.0").')
  if (!isRecord(value.metadata)) fail('metadata', 'objet attendu.')
  // Format stocké : `themes` ; on accepte aussi le vocabulaire interne (`categories`), pour qu'un quiz déjà converti
  // puisse repasser par `parseQuiz` (ex. `parseQuiz({ ...quiz, questions })`).
  const { metadata, questions } = value
  const themes = value.categories ?? value.themes
  for (const field of ['title', 'author', 'createdAt'] as const) {
    if (typeof metadata[field] !== 'string') fail(`metadata.${field}`, 'texte attendu.')
  }
  if (metadata.description !== undefined && typeof metadata.description !== 'string') fail('metadata.description', 'texte attendu.')
  // Seule une valeur qui n'est pas du texte est refusée : un code de langue inconnu (autre que fr/en) est toléré
  // et simplement signalé à l'affichage, voir `isKnownQuizLanguage`.
  if (metadata.language !== undefined && typeof metadata.language !== 'string') fail('metadata.language', 'texte attendu (ex. "fr").')
  if (!Array.isArray(themes)) fail('themes', 'liste attendue (au moins un thème { id, label }).')
  themes.forEach((theme, index) => {
    if (!isRecord(theme)) fail(`themes[${index}]`, 'objet { id, label } attendu.')
    if (typeof theme.id !== 'string') fail(`themes[${index}].id`, 'texte attendu.')
    if (typeof theme.label !== 'string') fail(`themes[${index}].label`, 'texte attendu.')
  })
  if (!Array.isArray(questions)) fail('questions', 'liste attendue.')

  // Image et liens sont optionnels (les quiz déjà stockés n'en ont pas) mais, une fois présents, strictement validés.
  const { image: rawImage, links: rawLinks, ...otherMetadata } = metadata
  const image = parseQuizImage(rawImage)
  const links = parseQuizLinks(rawLinks)

  const parsedQuestions = questions.map((question, index) => parseQuestion(question, index))
  const categoryIds = new Set(themes.map((theme) => (theme as { id: string }).id))
  parsedQuestions.forEach((question, index) => {
    if (!categoryIds.has(question.category)) fail(`questions[${index}].theme`, `thème « ${question.category} » inconnu (question « ${question.id} ») : chaque question doit référencer un thème existant de la liste « themes ».`)
  })
  return { version: value.version, metadata: { ...otherMetadata, ...(image && { image }), ...(links && { links }) } as Quiz['metadata'], categories: themes as Quiz['categories'], questions: parsedQuestions }
}

/** Format stocké / échangé d'un quiz (fichiers JSON, `quizzes.content`) : `themes` et, par question, `theme`.
 * Inverse de `parseQuiz` ; l'ordre des clés est conservé pour que l'export reste lisible. */
export function serializeQuiz(quiz: Quiz): Record<string, unknown> {
  const rename = (record: object, from: string, to: string) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? to : key, value]))
  return {
    version: quiz.version,
    metadata: quiz.metadata,
    themes: quiz.categories,
    questions: quiz.questions.map((question) => rename(question, 'category', 'theme')),
  }
}

const QUESTION_TYPES = ['qcm', 'text', 'code', 'ordering', 'boolean', 'cloze', 'matching', 'numeric']

function parseQuestion(value: unknown, index: number): Question {
  const at = `questions[${index}]`
  if (!isRecord(value)) fail(at, 'objet attendu.')
  const label = typeof value.id === 'string' ? ` (question « ${value.id} »)` : ''
  const bad = (field: string, problem: string): never => fail(`${at}.${field}`, `${problem}${label}`)
  // Même tolérance que pour le quiz : `theme` (format stocké) ou `category` (vocabulaire interne).
  const category = value.category ?? value.theme
  const { id, type, difficulty, question, tags, explanation, points, content, imageUrl, imageAlt, timeLimitSeconds, diagram, table } = value

  if (typeof id !== 'string') bad('id', 'texte attendu.')
  if (typeof category !== 'string') bad('theme', 'texte attendu (identifiant d\'un thème de la liste « themes »).')
  if (typeof type !== 'string' || !QUESTION_TYPES.includes(type)) bad('type', `un de ${QUESTION_TYPES.join(', ')} attendu.`)
  if (!['easy', 'medium', 'hard'].includes(String(difficulty))) bad('difficulty', '« easy », « medium » ou « hard » attendu.')
  if (typeof question !== 'string') bad('question', 'texte attendu (l\'énoncé).')
  if (typeof explanation !== 'string') bad('explanation', 'texte attendu.')
  if (typeof points !== 'number' || points < 0) bad('points', 'nombre positif ou nul attendu.')
  if (!hasStrings(tags)) bad('tags', 'liste de textes attendue (peut être vide).')
  if (imageUrl !== undefined && (typeof imageUrl !== 'string' || !imageUrl)) bad('imageUrl', 'texte non vide attendu.')
  if (imageAlt !== undefined && typeof imageAlt !== 'string') bad('imageAlt', 'texte attendu.')
  if (timeLimitSeconds !== undefined && (typeof timeLimitSeconds !== 'number' || timeLimitSeconds <= 0)) bad('timeLimitSeconds', 'nombre strictement positif attendu.')
  if (diagram !== undefined && (typeof diagram !== 'string' || !diagram)) bad('diagram', 'texte non vide attendu (syntaxe Mermaid).')
  if (table !== undefined) checkTable(table, `${at}.table`, label)
  if (!isRecord(content)) bad('content', 'objet attendu.')
  const data = content as Record<string, unknown>
  const inContent = (field: string, problem: string): never => bad(`content.${field}`, problem)

  const base = {
    id: id as string, category: category as string, difficulty: difficulty as Question['difficulty'], question: question as string, tags: tags as string[],
    explanation: explanation as string, points: points as number,
    imageUrl: imageUrl as string | undefined, imageAlt: imageAlt as string | undefined,
    timeLimitSeconds: timeLimitSeconds as number | undefined,
    diagram: diagram as string | undefined,
    table: table as Question['table'],
  }
  const checkAnswers = () => {
    if (!Array.isArray(data.answers)) inContent('answers', 'liste de { id, label, isCorrect } attendue.')
    ;(data.answers as unknown[]).forEach((answer, i) => {
      if (!isRecord(answer)) inContent(`answers[${i}]`, 'objet { id, label, isCorrect } attendu.')
      const entry = answer as Record<string, unknown>
      if (typeof entry.id !== 'string') inContent(`answers[${i}].id`, 'texte attendu.')
      if (typeof entry.label !== 'string') inContent(`answers[${i}].label`, 'texte attendu.')
      if (typeof entry.isCorrect !== 'boolean') inContent(`answers[${i}].isCorrect`, 'true ou false attendu.')
    })
    return data.answers as { id: string; label: string; isCorrect: boolean }[]
  }
  const checkItems = (field: string) => {
    if (!Array.isArray(data[field])) inContent(field, 'liste de { id, label } attendue.')
    ;(data[field] as unknown[]).forEach((item, i) => {
      if (!isRecord(item)) inContent(`${field}[${i}]`, 'objet { id, label } attendu.')
      const entry = item as Record<string, unknown>
      if (typeof entry.id !== 'string') inContent(`${field}[${i}].id`, 'texte attendu.')
      if (typeof entry.label !== 'string') inContent(`${field}[${i}].label`, 'texte attendu.')
    })
    return data[field] as { id: string; label: string }[]
  }
  const checkExpected = () => {
    if (!hasStrings(data.expectedAnswers)) inContent('expectedAnswers', 'liste de textes attendue.')
    if (typeof data.caseSensitive !== 'boolean') inContent('caseSensitive', 'true ou false attendu.')
    return { expectedAnswers: data.expectedAnswers as string[], caseSensitive: data.caseSensitive as boolean }
  }

  if (type === 'qcm') {
    if (typeof data.multiple !== 'boolean') inContent('multiple', 'true ou false attendu.')
    return { ...base, type, content: { multiple: data.multiple as boolean, answers: checkAnswers() } }
  }
  if (type === 'code') {
    if (typeof data.language !== 'string') inContent('language', 'texte attendu (ex. "java").')
    if (typeof data.snippet !== 'string') inContent('snippet', 'texte attendu (le code affiché).')
    if (data.multiple !== undefined && typeof data.multiple !== 'boolean') inContent('multiple', 'true ou false attendu.')
    // `multiple` optionnel (par défaut faux) : ajouté après coup, les questions "code" déjà publiées n'en ont pas.
    return { ...base, type, content: { language: data.language as string, snippet: data.snippet as string, multiple: Boolean(data.multiple), answers: checkAnswers() } }
  }
  if (type === 'text') return { ...base, type, content: checkExpected() }
  if (type === 'ordering') {
    const items = checkItems('items')
    if (!hasStrings(data.correctOrder)) inContent('correctOrder', 'liste des identifiants dans le bon ordre attendue.')
    const correctOrder = data.correctOrder as string[]
    const ids = new Set(items.map((item) => item.id))
    if (correctOrder.length !== items.length) inContent('correctOrder', `${items.length} identifiants attendus (un par élément de « items »), ${correctOrder.length} trouvés.`)
    correctOrder.forEach((itemId, i) => { if (!ids.has(itemId)) inContent(`correctOrder[${i}]`, `identifiant « ${itemId} » absent de « items ».`) })
    return { ...base, type, content: { items, correctOrder } }
  }
  if (type === 'boolean') {
    if (typeof data.isTrue !== 'boolean') inContent('isTrue', 'true ou false attendu.')
    return { ...base, type, content: { isTrue: data.isTrue as boolean } }
  }
  if (type === 'cloze') {
    const expected = checkExpected()
    if (!/_{3,}/.test(question as string)) bad('question', 'le texte à trous doit contenir un marqueur "___".')
    return { ...base, type, content: expected }
  }
  if (type === 'matching') {
    const left = checkItems('left')
    const right = checkItems('right')
    if (!isRecord(data.correctPairs)) inContent('correctPairs', 'objet { idGauche: idDroite } attendu.')
    const correctPairs = data.correctPairs as Record<string, unknown>
    const leftIds = new Set(left.map((item) => item.id))
    const rightIds = new Set(right.map((item) => item.id))
    Object.keys(correctPairs).forEach((leftId) => {
      if (!leftIds.has(leftId)) inContent(`correctPairs.${leftId}`, `« ${leftId} » n'est pas un identifiant de « left ».`)
      const target = correctPairs[leftId]
      if (typeof target !== 'string' || !rightIds.has(target)) inContent(`correctPairs.${leftId}`, `la valeur doit être un identifiant de « right ».`)
    })
    left.forEach((item) => { if (!(item.id in correctPairs)) inContent('correctPairs', `l'élément « ${item.id} » de « left » n'a pas de correspondance.`) })
    return { ...base, type, content: { left, right, correctPairs: correctPairs as Record<string, string> } }
  }
  // numeric
  for (const field of ['min', 'max', 'step', 'target', 'tolerance'] as const) {
    if (typeof data[field] !== 'number') inContent(field, 'nombre attendu.')
  }
  if (data.unit !== undefined && typeof data.unit !== 'string') inContent('unit', 'texte attendu.')
  const { min, max, step, target, tolerance } = data as Record<'min' | 'max' | 'step' | 'target' | 'tolerance', number>
  if (min >= max) inContent('min', '« min » doit être inférieur à « max ».')
  if (target < min || target > max) inContent('target', '« target » doit être compris entre « min » et « max ».')
  if (tolerance < 0) inContent('tolerance', 'nombre positif ou nul attendu.')
  return { ...base, type: 'numeric', content: { min, max, step, target, tolerance, unit: data.unit as string | undefined } }
}
