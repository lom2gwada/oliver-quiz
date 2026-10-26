import { useTranslation } from '../i18n'
import type { QuizLink } from '../types/quiz'

/** Bloc « Pour aller plus loin » : les liens de `metadata.links`, ouverts dans un nouvel onglet. Un lien `commercial`
 * (achat) est signalé comme tel. Sans lien, rien n'est affiché. */
export function FurtherReading({ links }: { links: QuizLink[] | undefined }) {
  const { t } = useTranslation()
  if (!links?.length) return null
  return <section className="further-reading" aria-labelledby="further-reading-title">
    <h3 className="stats-group-title" id="further-reading-title">{t('links.title')}</h3>
    <ul>
      {links.map((link) => <li key={`${link.url}|${link.label}`}>
        <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true"> ↗</span><span className="sr-only"> {t('links.newTab')}</span></a>
        {link.commercial && <span className="link-commercial">{t('links.commercial')}</span>}
      </li>)}
    </ul>
  </section>
}
