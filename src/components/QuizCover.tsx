import { useState } from 'react'
import type { QuizImage } from '../types/quiz'

/** Image de couverture d'un quiz (`metadata.image`). Boîte à dimensions fixes — pas de décalage de mise en page pendant
 * le chargement — et image de remplacement neutre quand l'URL (hotlinkée) ne se charge plus. Sans image, rien n'est
 * affiché : les quiz qui n'en ont pas ne réservent pas de place vide. */
export function QuizCover({ image, size = 'small' }: { image: QuizImage | undefined; size?: 'small' | 'large' }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!image) return null
  const className = `quiz-cover quiz-cover-${size}`
  if (failedUrl === image.url) return <span className={`${className} quiz-cover-fallback`} aria-hidden="true">📖</span>
  return <span className={className}><img src={image.url} alt={image.alt} loading="lazy" onError={() => setFailedUrl(image.url)} /></span>
}
