/** Icône du bouton son : un haut-parleur tracé avec `currentColor`, donc toujours aussi contrasté que le texte du bouton
 * dans les deux thèmes (l'émoji 🔊 gardait ses couleurs pastel, presque invisibles sur le fond clair). */
export function SoundIcon({ muted }: { muted: boolean }) {
  return <svg className="sound-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
    {muted
      ? <>
        <line x1="16" y1="9" x2="22" y2="15" />
        <line x1="22" y1="9" x2="16" y2="15" />
      </>
      : <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>}
  </svg>
}
