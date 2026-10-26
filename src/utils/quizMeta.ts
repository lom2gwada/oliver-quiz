import type { QuizImage, QuizLink } from '../types/quiz'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Seules les URL `https://` sont acceptées pour l'image et les liens : pas de `http:`, de `javascript:` ni de `data:`. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

export type ImageIssue = 'url' | 'alt'
export type LinkIssue = 'label' | 'url'

/** Ce qui manque ou ne va pas dans l'image saisie (`null` = valide). L'URL passe avant le texte alternatif. */
export function imageIssue(image: { url: string; alt: string }): ImageIssue | null {
  if (!isHttpsUrl(image.url)) return 'url'
  return image.alt.trim() ? null : 'alt'
}

export function linkIssue(link: { label: string; url: string }): LinkIssue | null {
  if (!link.label.trim()) return 'label'
  return isHttpsUrl(link.url) ? null : 'url'
}

/** `metadata.image` d'un fichier de quiz : absente → `undefined`, sinon `{ url, alt }` valides (`alt` obligatoire). */
export function parseQuizImage(value: unknown): QuizImage | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || typeof value.url !== 'string') throw new Error('metadata.image doit être un objet { url, alt }.')
  const image = { url: value.url.trim(), alt: typeof value.alt === 'string' ? value.alt.trim() : '' }
  const issue = imageIssue(image)
  if (issue === 'url') throw new Error('metadata.image.url doit être une URL https:// valide.')
  if (issue === 'alt') throw new Error('metadata.image.alt (texte alternatif) est obligatoire quand une image est renseignée.')
  return image
}

/** `metadata.links` : absente ou vide → `undefined`, sinon la liste de `{ label, url, commercial? }` valides. */
export function parseQuizLinks(value: unknown): QuizLink[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new Error('metadata.links doit être une liste de { label, url, commercial? }.')
  const links = value.map((entry, index): QuizLink => {
    const position = `metadata.links[${index}]`
    if (!isRecord(entry) || typeof entry.label !== 'string' || typeof entry.url !== 'string') throw new Error(`${position} doit être un objet { label, url, commercial? }.`)
    if (entry.commercial !== undefined && typeof entry.commercial !== 'boolean') throw new Error(`${position}.commercial doit être un booléen.`)
    const link = { label: entry.label.trim(), url: entry.url.trim() }
    const issue = linkIssue(link)
    if (issue === 'label') throw new Error(`${position}.label est obligatoire.`)
    if (issue === 'url') throw new Error(`${position}.url doit être une URL https:// valide.`)
    return entry.commercial ? { ...link, commercial: true } : link
  })
  return links.length ? links : undefined
}
