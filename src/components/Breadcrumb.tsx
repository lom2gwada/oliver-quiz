import type { Crumb } from '../utils/pageContext'

/** Fil d'Ariane : les étapes parentes sont de vrais liens (les pages ont une URL, voir `utils/routes.ts`), la page
 * courante est le dernier élément, en texte. */
export function Breadcrumb({ items, label }: { items: Crumb[]; label: string }) {
  return <nav className="breadcrumb" aria-label={label}>
    <ol>
      {items.map((item, index) => index === items.length - 1 || !item.href
        ? <li key={index} aria-current="page">{item.label}</li>
        : <li key={index}><a href={item.href}>{item.label}</a></li>)}
    </ol>
  </nav>
}
