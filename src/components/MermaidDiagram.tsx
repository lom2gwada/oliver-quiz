import { useEffect, useId, useState } from 'react'

/** La bibliothèque Mermaid est assez lourde (~500 Ko avec ses dépendances) : import dynamique pour que
 * les quiz sans diagramme ne paient jamais ce coût. Comme QuestionImage, on masque proprement en cas
 * d'erreur de rendu (syntaxe Mermaid invalide) plutôt que de casser la page. */
export function MermaidDiagram({ chart }: { chart: string }) {
  const renderId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setBroken(false)
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        if (cancelled) return
        mermaid.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark' })
        const { svg: rendered } = await mermaid.render(`mermaid-${renderId}`, chart)
        if (!cancelled) setSvg(rendered)
      })
      .catch((error) => { console.error('Mermaid render failed', error); if (!cancelled) setBroken(true) })
    return () => { cancelled = true }
  }, [chart, renderId])

  if (broken || !svg) return null
  return <div className="question-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
}
