/** Mélange Fisher-Yates : ne modifie pas le tableau reçu. */
export function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
  }
  return shuffled
}

/** Mélange des items identifiés, en garantissant que l'ordre obtenu n'est pas `forbiddenOrder` (liste d'ids).
 * Sert aux questions "Ordre" : l'ordre affiché au départ ne doit jamais être déjà la solution. Si le mélange
 * retombe par hasard sur l'ordre interdit, on échange les deux premiers items — suffisant pour s'en écarter. */
export function shuffleAwayFrom<T extends { id: string }>(items: T[], forbiddenOrder: string[]): T[] {
  const shuffled = shuffle(items)
  const isForbidden = shuffled.length === forbiddenOrder.length && shuffled.every((item, index) => item.id === forbiddenOrder[index])
  if (isForbidden && shuffled.length > 1) [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
  return shuffled
}
