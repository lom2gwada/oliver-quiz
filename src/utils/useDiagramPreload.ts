import { useEffect } from 'react'
import type { Question } from '../types/quiz'
import { preloadDiagrams } from './mermaidRender'

/** À appeler par chaque page de jeu avec les questions de la partie : charge Mermaid avant la première question à
 * diagramme (voir `preloadDiagrams`). Sans effet, et sans rien télécharger, si aucune question n'a de diagramme. */
export function useDiagramPreload(questions: readonly Pick<Question, 'diagram'>[]) {
  useEffect(() => { void preloadDiagrams(questions) }, [questions])
}
