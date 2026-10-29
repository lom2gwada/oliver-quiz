import { useTranslation } from '../i18n'
import type { QuizLink } from '../types/quiz'

/** Un lien du bloc : nouvel onglet, `noopener noreferrer`, mention « lien d'achat » pour un lien `commercial`. */
function LinkItem({ link }: { link: QuizLink }) {
  const { t } = useTranslation()
  return <>
    <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true"> ↗</span><span className="sr-only"> {t('links.newTab')}</span></a>
    {link.commercial && <span className="link-commercial">{t('links.commercial')}</span>}
  </>
}

/** Bloc « Pour aller plus loin » : les liens de `metadata.links`, ouverts dans un nouvel onglet. Un lien `commercial`
 * (achat) est signalé comme tel. Sans lien, rien n'est affiché. */
export function FurtherReading({ links }: { links: QuizLink[] | undefined }) {
  const { t } = useTranslation()
  if (!links?.length) return null
  return <section className="further-reading" aria-labelledby="further-reading-title">
    <h3 className="stats-group-title" id="further-reading-title">{t('links.title')}</h3>
    <ul>
      {links.map((link) => <li key={`${link.url}|${link.label}`}><LinkItem link={link} /></li>)}
    </ul>
  </section>
}

/** Les mêmes liens sur une seule ligne, pour l'accueil du quiz : un joueur qui n'a pas encore fini de partie les voit
 * aussi (le bloc complet n'apparaît que sur les écrans de résultat). */
export function FurtherReadingInline({ links }: { links: QuizLink[] | undefined }) {
  const { t } = useTranslation()
  if (!links?.length) return null
  return <p className="further-reading-inline">
    <span>{t('links.title')} :</span>
    {links.map((link) => <span className="further-reading-item" key={`${link.url}|${link.label}`}><LinkItem link={link} /></span>)}
  </p>
}
