/** Ce que la page « À propos » affiche de propre à l'application : à qui elle est, où est son code, qui la fait vivre. Les
 * textes (en français et en anglais) sont dans `i18n/` ; seules les valeurs qui changeraient d'une appli à l'autre sont
 * ici, pour que cette page puisse un jour passer dans le moteur commun avec une configuration par appli. */
export interface AboutConfig {
  appName: string
  /** Éditeur et titulaire du copyright. */
  owner: string
  year: number
  /** Dépôt public du code source, sans barre finale. */
  repoUrl: string
  /** Adresse de contact dédiée, coupée en deux pour ne jamais figurer d'un seul tenant dans le code de la page (voir
   * `contactAddress`). `null` tant qu'aucune n'est choisie : la page renvoie alors vers les demandes GitHub. */
  contact: { user: string; domain: string } | null
  /** Bibliothèques et services cités dans les crédits. */
  libraries: { name: string; url: string }[]
  services: { name: string; url: string }[]
}

export const ABOUT: AboutConfig = {
  appName: 'Oliver Quiz',
  owner: 'Olivier Larocque',
  year: 2026,
  repoUrl: 'https://github.com/lom2gwada/oliver-quiz',
  contact: null,
  libraries: [
    { name: 'React', url: 'https://react.dev' },
    { name: 'Vite', url: 'https://vite.dev' },
    { name: 'TypeScript', url: 'https://www.typescriptlang.org' },
    { name: 'Mermaid', url: 'https://mermaid.js.org' },
    { name: 'Prism', url: 'https://prismjs.com' },
  ],
  services: [
    { name: 'Supabase', url: 'https://supabase.com' },
    { name: 'GitHub Pages', url: 'https://pages.github.com' },
  ],
}

/** L'adresse de contact assemblée, ou `null` sans contact configuré. */
export function contactAddress(contact: AboutConfig['contact']): string | null {
  return contact ? `${contact.user}@${contact.domain}` : null
}

/** L'adresse telle qu'on l'affiche : « prenom [at] domaine.fr », qui ne se lit pas comme une adresse pour un robot. */
export function contactDisplay(contact: AboutConfig['contact']): string | null {
  return contact ? `${contact.user} [at] ${contact.domain}` : null
}
