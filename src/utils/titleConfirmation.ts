/** Forme comparable d'un titre : accents composés, espaces simplifiés, majuscules ignorées, et les tirets et apostrophes
 * typographiques (— – ’) ramenés aux caractères du clavier. Le titre « Java — Niveau Expert » se saisit alors avec un
 * simple « - », sans rien perdre de la vérification : il faut toujours avoir lu et retapé le nom du quiz. */
export function normalizeTitleForConfirmation(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Vrai si `typed` est le titre du quiz (au sens de `normalizeTitleForConfirmation`). Un champ vide ne correspond
 * jamais, même pour un quiz dont le titre serait vide. */
export function matchesQuizTitle(typed: string, title: string): boolean {
  const expected = normalizeTitleForConfirmation(title)
  return expected !== '' && normalizeTitleForConfirmation(typed) === expected
}
