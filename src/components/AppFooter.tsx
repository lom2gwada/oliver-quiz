import { useTranslation } from '../i18n'
import { ABOUT } from '../config/about'

/** Pied de page de toutes les pages : copyright, version (identifiant du commit déployé) et accès à « À propos ». */
export function AppFooter({ onAbout }: { onAbout: () => void }) {
  const { t } = useTranslation()
  return <footer className="app-footer">
    <span>© {ABOUT.year} {ABOUT.owner}</span>
    <span>{t('footer.version', __COMMIT_HASH__)}</span>
    <button type="button" className="footer-link" onClick={onAbout}>{t('footer.about')}</button>
  </footer>
}
