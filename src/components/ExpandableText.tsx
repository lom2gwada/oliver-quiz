import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'

/** Texte limité à quelques lignes (voir `.expandable-text`) avec « Lire la suite » / « Réduire ». Le bouton n'apparaît
 * que si le texte est réellement coupé à la largeur courante : un texte court n'en a pas, un texte long en a un même
 * si la fenêtre est redimensionnée. À remonter avec `key={text}` pour qu'un autre texte reparte replié. */
export function ExpandableText({ text, className }: { text: string; className?: string }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [truncated, setTruncated] = useState(false)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || expanded) return
    const measure = () => setTruncated(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, expanded])

  return <>
    <p ref={ref} className={`expandable-text${expanded ? ' is-expanded' : ''}${className ? ` ${className}` : ''}`}>{text}</p>
    {(truncated || expanded) && <button type="button" className="text-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? t('description.readLess') : t('description.readMore')}</button>}
  </>
}
