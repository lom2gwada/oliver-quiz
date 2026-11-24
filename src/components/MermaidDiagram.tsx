import { useEffect, useId, useState } from 'react'
import { useTranslation } from '../i18n'
import { describeError, renderDiagram } from '../utils/mermaidRender'

/** Dessine un diagramme Mermaid en SVG (voir `mermaidRender.ts` : chargement paresseux, nouvel essai automatique si un
 * téléchargement échoue). Si le dessin reste impossible, on le dit en une phrase plutôt que de casser la page ou de laisser
 * l'erreur de Mermaid s'afficher en bas de page ; la cause est écrite discrètement dessous, et « Réessayer » relance le
 * dessin sans quitter la page (recharger ferait perdre une partie en cours). */
export function MermaidDiagram({ chart }: { chart: string }) {
  const { t } = useTranslation()
  const renderId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setFailure(null)
    renderDiagram(`mermaid-${renderId}-${attempt}`, chart, () => !cancelled)
      .then((rendered) => { if (!cancelled) setSvg(rendered) })
      .catch((error) => { console.error('Mermaid render failed', error); if (!cancelled) setFailure(describeError(error) || 'Mermaid') })
    return () => { cancelled = true }
  }, [chart, renderId, attempt])

  if (failure !== null) {
    return <div className="question-diagram question-diagram-error" role="note">
      <p>{t('quiz.diagramError')}</p>
      <p><small className="question-diagram-cause">{failure}</small></p>
      <button type="button" className="secondary" onClick={() => setAttempt((value) => value + 1)}>{t('quiz.diagramRetry')}</button>
    </div>
  }
  if (!svg) return null
  return <div className="question-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
}
