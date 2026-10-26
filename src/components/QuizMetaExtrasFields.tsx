import { useTranslation } from '../i18n'
import { imageIssue, isHttpsUrl, linkIssue } from '../utils/quizMeta'
import { QuizCover } from './QuizCover'

export interface LinkDraft { label: string; url: string; commercial: boolean }

/** Une ligne entièrement vide est un ajout laissé en plan : elle est ignorée, pas signalée comme une erreur. */
export const isBlankLink = (link: LinkDraft): boolean => !link.label.trim() && !link.url.trim()

/** Vrai quand l'image et chaque lien saisis sont valides (une image ou une ligne de lien vide est ignorée). */
export function extrasAreValid(imageUrl: string, imageAlt: string, links: LinkDraft[]): boolean {
  const imageBlank = !imageUrl.trim() && !imageAlt.trim()
  return (imageBlank || imageIssue({ url: imageUrl, alt: imageAlt }) === null) && links.every((link) => isBlankLink(link) || linkIssue(link) === null)
}

interface QuizMetaExtrasFieldsProps {
  imageUrl: string
  imageAlt: string
  links: LinkDraft[]
  onImageUrlChange: (value: string) => void
  onImageAltChange: (value: string) => void
  onLinksChange: (links: LinkDraft[]) => void
}

/** Champs « image de couverture » (avec aperçu) et « Pour aller plus loin » (ajout, retrait, réordonnancement) du
 * formulaire de modification des informations d'un quiz (`metadata.image`, `metadata.links`). */
export function QuizMetaExtrasFields({ imageUrl, imageAlt, links, onImageUrlChange, onImageAltChange, onLinksChange }: QuizMetaExtrasFieldsProps) {
  const { t } = useTranslation()
  const imageBlank = !imageUrl.trim() && !imageAlt.trim()
  const imageProblem = imageBlank ? null : imageIssue({ url: imageUrl, alt: imageAlt })
  const update = (index: number, patch: Partial<LinkDraft>) => onLinksChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  const move = (index: number, delta: number) => {
    const next = [...links]
    const moved = next[index]
    next[index] = next[index + delta]
    next[index + delta] = moved
    onLinksChange(next)
  }

  return <>
    <label>{t('admin.quizImageUrlLabel')}<input type="text" inputMode="url" autoComplete="off" value={imageUrl} onChange={(event) => onImageUrlChange(event.target.value)} placeholder="https://…" /></label>
    <label>{t('admin.quizImageAltLabel')}<input type="text" value={imageAlt} onChange={(event) => onImageAltChange(event.target.value)} /></label>
    {imageProblem === 'url' && <p className="mode-hint" role="status">{t('admin.imageErrorUrl')}</p>}
    {imageProblem === 'alt' && <p className="mode-hint" role="status">{t('admin.imageErrorAlt')}</p>}
    {isHttpsUrl(imageUrl) && <div className="quiz-cover-preview"><QuizCover key={imageUrl.trim()} image={{ url: imageUrl.trim(), alt: imageAlt.trim() }} size="large" /></div>}

    <fieldset className="quiz-links-fieldset">
      <legend>{t('admin.linksLegend')}</legend>
      {links.map((link, index) => {
        const problem = isBlankLink(link) ? null : linkIssue(link)
        return <div className="quiz-link-row" key={index}>
          <input type="text" aria-label={t('admin.linkLabelAria', index + 1)} placeholder={t('admin.linkLabelPlaceholder')} value={link.label} onChange={(event) => update(index, { label: event.target.value })} />
          <input type="text" inputMode="url" autoComplete="off" aria-label={t('admin.linkUrlAria', index + 1)} placeholder="https://…" value={link.url} onChange={(event) => update(index, { url: event.target.value })} />
          <label className="theme-checkbox"><input type="checkbox" checked={link.commercial} onChange={(event) => update(index, { commercial: event.target.checked })} />{t('admin.linkCommercialLabel')}</label>
          <div className="quiz-link-row-actions">
            <button type="button" className="secondary" disabled={index === 0} aria-label={t('admin.linkMoveUpAria', index + 1)} onClick={() => move(index, -1)}>↑</button>
            <button type="button" className="secondary" disabled={index === links.length - 1} aria-label={t('admin.linkMoveDownAria', index + 1)} onClick={() => move(index, 1)}>↓</button>
            <button type="button" className="secondary" aria-label={t('admin.linkRemoveAria', index + 1)} onClick={() => onLinksChange(links.filter((_, i) => i !== index))}>✕</button>
          </div>
          {problem && <p className="mode-hint" role="status">{problem === 'label' ? t('admin.linkErrorLabel', index + 1) : t('admin.linkErrorUrl', index + 1)}</p>}
        </div>
      })}
      <button type="button" className="secondary" onClick={() => onLinksChange([...links, { label: '', url: '', commercial: false }])}>{t('admin.addLinkButton')}</button>
    </fieldset>
  </>
}
