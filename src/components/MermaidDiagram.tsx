import { useEffect, useId, useState } from 'react'
import { useTranslation } from '../i18n'

/** Quand `render` échoue, Mermaid laisse à la fin de la page son propre dessin d'erreur (« Syntax error in text ») dans un
 * `div` d'identifiant `d<id>` : on le retire, la page n'a pas à s'encombrer d'un diagramme qu'on remplace par un message. */
function removeLeftovers(id: string) {
  document.getElementById(`d${id}`)?.remove()
  document.getElementById(id)?.remove()
}

/** La bibliothèque Mermaid est assez lourde (~500 Ko avec ses dépendances) : import dynamique pour que
 * les quiz sans diagramme ne paient jamais ce coût. En cas d'erreur de rendu (syntaxe Mermaid invalide) on le
 * dit en une phrase plutôt que de casser la page ou de laisser l'erreur de Mermaid s'afficher en bas de page. */
export function MermaidDiagram({ chart }: { chart: string }) {
  const { t } = useTranslation()
  const renderId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${renderId}`
    setSvg(null)
    setBroken(false)
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        if (cancelled) return
        mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true, theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark' })
        const { svg: rendered } = await mermaid.render(id, chart)
        if (!cancelled) setSvg(rendered)
      })
      .catch((error) => { console.error('Mermaid render failed', error); removeLeftovers(id); if (!cancelled) setBroken(true) })
    return () => { cancelled = true }
  }, [chart, renderId])

  if (broken) return <p className="question-diagram question-diagram-error" role="note">{t('quiz.diagramError')}</p>
  if (!svg) return null
  return <div className="question-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
}
