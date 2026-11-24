import type { Question } from '../types/quiz'

type MermaidApi = (typeof import('mermaid'))['default']

/** Pauses (ms) avant chaque nouvel essai automatique : trois tentatives en tout, soit environ 1,6 s d'attente au pire. */
export const RETRY_DELAYS_MS: readonly number[] = [400, 1200]

let loading: Promise<MermaidApi> | null = null

/** La bibliothèque Mermaid est lourde (~500 Ko avec ses dépendances) : import dynamique, pour que les quiz sans diagramme ne
 * paient jamais ce coût. Un import réussi est gardé ; un import qui échoue n'est PAS gardé, pour qu'un nouvel essai
 * (automatique ou bouton « Réessayer ») puisse le relancer au lieu de resservir la même erreur. */
export function loadMermaid(): Promise<MermaidApi> {
  if (!loading) {
    loading = import('mermaid').then((module) => module.default).catch((error) => { loading = null; throw error })
  }
  return loading
}

function configure(mermaid: MermaidApi) {
  mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true, theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark' })
}

/** Vrai si l'erreur ressemble à un téléchargement raté (réseau coupé, fichier introuvable après un déploiement) plutôt qu'à une
 * syntaxe Mermaid invalide : seul le premier cas vaut la peine d'être retenté. Les navigateurs disent la même chose avec
 * des mots différents, mais c'est toujours une `TypeError` (« Failed to fetch dynamically imported module »,
 * « error loading dynamically imported module », « Importing a module script failed »). */
export function isLoadFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|importing a module script|failed to fetch|networkerror|load failed|loading chunk|loading css chunk/i.test(message)
}

/** La cause d'une erreur en une ligne, pour l'afficher discrètement sous le message : la console n'est pas toujours ouverte
 * quand le problème survient, et il est alors impossible de savoir ce qui s'est passé. */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const firstLine = message.split('\n').map((line) => line.trim()).find(Boolean) ?? ''
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Dessine `chart` en SVG. Un échec de téléchargement est retenté après un court délai (plusieurs essais) ; une syntaxe
 * invalide échoue tout de suite, sans attente inutile. `shouldContinue` permet d'abandonner les essais quand la question
 * affichée a changé entre-temps. */
export async function renderDiagram(id: string, chart: string, shouldContinue: () => boolean = () => true, delays: readonly number[] = RETRY_DELAYS_MS): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const mermaid = await loadMermaid()
      configure(mermaid)
      const { svg } = await mermaid.render(id, chart)
      return svg
    } catch (error) {
      // Mermaid laisse son propre dessin d'erreur (« Syntax error in text ») dans un `div` d'identifiant `d<id>`.
      document.getElementById(`d${id}`)?.remove()
      document.getElementById(id)?.remove()
      if (attempt >= delays.length || !isLoadFailure(error) || !shouldContinue()) throw error
      await wait(delays[attempt])
      if (!shouldContinue()) throw error
    }
  }
}

/** Le premier mot du diagramme dit de quel type il est (`classDiagram`, `sequenceDiagram`, `flowchart`, `gitGraph`...). */
export function diagramKind(chart: string): string {
  const lines = chart.split('\n').map((line) => line.trim())
  let start = 0
  if (lines[0] === '---') { const end = lines.indexOf('---', 1); if (end > 0) start = end + 1 }
  const first = lines.slice(start).find((line) => line && !line.startsWith('%%')) ?? ''
  return first.split(/\s+/)[0]
}

/** Au lancement d'une partie, charge Mermaid et chaque type de diagramme utilisé par les questions tirées : sans cela le
 * téléchargement (environ 700 Ko) a lieu au milieu d'une question, pendant que son chrono tourne, et une coupure réseau à
 * ce moment-là fait perdre le diagramme. Un seul exemplaire par type suffit, et une erreur ici est sans importance : le
 * composant réessaiera de toute façon au moment d'afficher la question. */
export async function preloadDiagrams(questions: readonly Pick<Question, 'diagram'>[]): Promise<void> {
  const samples = new Map<string, string>()
  for (const { diagram } of questions) {
    if (diagram && !samples.has(diagramKind(diagram))) samples.set(diagramKind(diagram), diagram)
  }
  if (!samples.size) return
  try {
    const mermaid = await loadMermaid()
    configure(mermaid)
    for (const sample of samples.values()) {
      try { await mermaid.parse(sample, { suppressErrors: true }) } catch { /* sans importance, voir plus haut */ }
    }
  } catch { /* idem */ }
}
