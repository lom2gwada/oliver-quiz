import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { ABOUT, contactAddress, contactDisplay, type AboutConfig } from '../config/about'
import { longDate } from '../utils/dateFormat'

/** Lien `mailto:` posé après l'affichage : l'adresse n'est pas dans le HTML d'origine, et le texte ne la montre pas
 * d'un seul tenant. */
function ContactLink({ contact }: { contact: NonNullable<AboutConfig['contact']> }) {
  const [href, setHref] = useState<string | undefined>(undefined)
  useEffect(() => { setHref(`mailto:${contactAddress(contact)}`) }, [contact])
  return <a href={href}>{contactDisplay(contact)}</a>
}

const externalLinkProps = { target: '_blank', rel: 'noopener noreferrer' } as const

function LinkList({ entries }: { entries: { name: string; url: string }[] }) {
  return <>{entries.map((entry, index) => <span key={entry.name}>
    {index > 0 && ', '}<a href={entry.url} {...externalLinkProps}>{entry.name}</a>
  </span>)}</>
}

/** Page « À propos » : présentation, version, contact, copyright, crédits, mentions légales et confidentialité. Elle ne
 * demande aucun compte (elle s'ouvre aussi depuis l'écran de connexion) et ne lit rien dans la base. */
export function AboutPage({ onBack, config = ABOUT }: { onBack: () => void; config?: AboutConfig }) {
  const { t, language } = useTranslation()
  return <section className="stats-page about-page">
    <div className="stats-header">
      <h2>{t('about.title', config.appName)}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>

    <h3 className="stats-group-title">{t('about.presentationTitle')}</h3>
    <p>{t('about.presentation', config.appName)}</p>
    <p>{t('about.questionTypes')}</p>
    <p>{t('about.modes')}</p>

    <h3 className="stats-group-title">{t('about.versionTitle')}</h3>
    <p>{t('about.version', __COMMIT_HASH__, longDate(__BUILD_DATE__, language))}</p>
    <p><a href={config.repoUrl} {...externalLinkProps}>{t('about.sourceCode')}</a></p>

    <h3 className="stats-group-title">{t('about.contactTitle')}</h3>
    {config.contact
      ? <p>{t('about.contactEmail')} <ContactLink contact={config.contact} /></p>
      : <p>{t('about.contactFallback')} <a href={`${config.repoUrl}/issues`} {...externalLinkProps}>{t('about.contactFallbackLink')}</a></p>}

    <h3 className="stats-group-title">{t('about.copyrightTitle')}</h3>
    <p>{t('about.copyright', config.year, config.owner)}</p>
    <p>{t('about.license')}</p>

    <h3 className="stats-group-title">{t('about.creditsTitle')}</h3>
    <p>{t('about.creditsQuizzes')}</p>
    <p>{t('about.creditsImages')}</p>
    <p>{t('about.creditsLibraries')} <LinkList entries={config.libraries} />.</p>
    <p>{t('about.creditsServices')} <LinkList entries={config.services} />.</p>

    <h3 className="stats-group-title">{t('about.legalTitle')}</h3>
    <ul>
      <li>{t('about.legalPublisher', config.owner)}</li>
      <li>{t('about.legalSiteHost')}</li>
      <li>{t('about.legalDataHost')}</li>
    </ul>

    <h3 className="stats-group-title">{t('about.privacyTitle')}</h3>
    <h4>{t('about.privacyCollectedTitle')}</h4>
    <ul>
      <li>{t('about.privacyAccount')}</li>
      <li>{t('about.privacyProfile')}</li>
      <li>{t('about.privacyGames')}</li>
      <li>{t('about.privacyLeaderboard')}</li>
      <li>{t('about.privacyGuests')}</li>
    </ul>
    <h4>{t('about.privacyPurposeTitle')}</h4>
    <p>{t('about.privacyPurpose')}</p>
    <h4>{t('about.privacyRetentionTitle')}</h4>
    <p>{t('about.privacyRetention')}</p>
    <h4>{t('about.privacyDeviceTitle')}</h4>
    <p>{t('about.privacyDevice')}</p>
    <h4>{t('about.privacyRightsTitle')}</h4>
    <p>{t('about.privacyRights')}</p>
  </section>
}
