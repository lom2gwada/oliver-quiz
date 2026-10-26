import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LanguageProvider } from '../i18n'
import { ABOUT, type AboutConfig } from '../config/about'
import { AboutPage } from './AboutPage'

const render = (language: 'fr' | 'en', config: AboutConfig = ABOUT) =>
  renderToStaticMarkup(createElement(LanguageProvider, { language, children: createElement(AboutPage, { onBack: () => undefined, config }) }))

describe('AboutPage', () => {
  it('has the sections of the ticket, with structured headings', () => {
    const html = render('fr')
    for (const title of ['Présentation', 'Version', 'Contact', 'Copyright et licence', 'Crédits', 'Mentions légales', 'Confidentialité et données personnelles']) {
      expect(html).toContain(`>${title}</h3>`)
    }
    expect(html).toContain('<h2>À propos d&#x27;Oliver Quiz</h2>')
  })

  it('shows the copyright, the version and the repository link', () => {
    const html = render('fr')
    expect(html).toContain(`© ${ABOUT.year} ${ABOUT.owner}. Tous droits réservés.`)
    expect(html).toContain('Version ')
    expect(html).toContain(`href="${ABOUT.repoUrl}"`)
  })

  it('opens every external link in a new tab with noopener noreferrer', () => {
    const html = render('fr')
    const links = html.match(/<a [^>]*>/g) ?? []
    expect(links.length).toBeGreaterThan(5)
    for (const link of links) {
      expect(link).toContain('target="_blank"')
      expect(link).toContain('rel="noopener noreferrer"')
    }
  })

  it('credits the libraries and services, and says where the data lives', () => {
    const html = render('fr')
    for (const entry of [...ABOUT.libraries, ...ABOUT.services]) expect(html).toContain(`>${entry.name}</a>`)
    expect(html).toContain('GitHub Pages')
    expect(html).toContain('eu-west-1')
  })

  it('is available in English too', () => {
    const html = render('en')
    expect(html).toContain('About Oliver Quiz')
    expect(html).toContain('Privacy and personal data')
    expect(html).not.toContain('Mentions légales')
  })

  it('falls back to the GitHub issues without a configured contact', () => {
    const html = render('fr', { ...ABOUT, contact: null })
    expect(html).toContain(`href="${ABOUT.repoUrl}/issues"`)
    expect(html).not.toContain('mailto:')
  })

  it('never puts a configured contact address in the page as it is first rendered', () => {
    const html = render('fr', { ...ABOUT, contact: { user: 'bonjour', domain: 'example.org' } })
    expect(html).toContain('bonjour [at] example.org')
    expect(html).not.toContain('bonjour@example.org')
    expect(html).not.toContain('mailto:')
  })
})
