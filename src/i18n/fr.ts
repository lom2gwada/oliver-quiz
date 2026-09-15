import type { GameMode } from '../types/quiz'

/** Dictionnaire français — source de vérité : ses clés définissent `TranslationKey` (voir `index.tsx`).
 * Chaque valeur est soit une chaîne statique, soit une fonction pour les chaînes interpolées/pluralisées. */
export const fr = {
  'common.back': 'Retour',
  'common.save': 'Enregistrer',
  'common.saving': 'Enregistrement…',
  'common.cancel': 'Annuler',
  'common.logout': 'Se déconnecter',
  'common.viewHistory': '🕓 Historique',
  'common.viewLeaderboard': '🏆 Classement',
  'common.modeClassic': '🎯 Classique',
  'common.modeStreak': '🔥 Sans-faute',
  'common.modeTimed': '⏱️ Contre-la-montre',

  'nav.profile': '👤 Profil',
  'nav.quiz': '⚙️ Quiz',
  'nav.muteSound': 'Couper le son',
  'nav.unmuteSound': 'Activer le son',
  'nav.by': (author: string) => `par ${author}`,

  'start.quizLabel': 'Quiz',
  'start.modeGroupLabel': 'Mode de jeu',
  'start.questionCountLabel': 'Nombre de questions',
  'start.questionCountOption': (count: number, unavailable: boolean) =>
    `${count} ${count === 1 ? 'question' : 'questions'}${unavailable ? ' (indisponible)' : ''}`,
  'start.allQuestionsOption': (count: number) => `Toutes les questions (${count})`,
  'start.streakHint': "Répondez correctement à la chaîne, sans limite de temps : la partie s'arrête à la première erreur.",
  'start.durationLabel': 'Durée',
  'start.durationOption': (minutes: number) => minutes === 0 ? 'Infini' : `${minutes} minutes`,
  'start.timerToggle': '⏳ Chrono par question',
  'start.availability': (count: number, mode: GameMode, drawn: number) => {
    const base = `${count} question${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`
    if (mode === 'classic') return `${base} — ${drawn} seront tirées aléatoirement.`
    if (mode === 'timed') return `${base} — elles peuvent revenir plusieurs fois si le temps le permet.`
    return `${base}.`
  },
  'start.startClassic': 'Démarrer le quiz',
  'start.startStreak': 'Démarrer la série',
  'start.startTimed': 'Démarrer le chrono',
  'start.confirmAbandon': 'Abandonner la partie en cours ? Votre progression sera perdue.',

  'admin.errorLoadQuiz': 'Impossible de charger ce quiz.',
  'admin.errorDuplicateTitle': 'Un quiz avec ce titre existe déjà.',
  'admin.errorCreateQuiz': 'Impossible de créer ce quiz.',
  'admin.errorInvalidJson': 'Fichier JSON invalide.',
  'admin.errorSaveQuestion': "Impossible d'enregistrer cette question.",
  'admin.errorAddQuestion': "Impossible d'ajouter cette question.",
  'admin.confirmDeleteQuestion': 'Supprimer définitivement cette question ?',
  'admin.errorDeleteQuestion': 'Impossible de supprimer cette question.',
  'admin.errorDuplicateTheme': 'Un thème avec ce nom existe déjà.',
  'admin.errorAddTheme': "Impossible d'ajouter ce thème.",
  'admin.errorDuplicateTitleOther': 'Un autre quiz porte déjà ce titre.',
  'admin.errorUpdateQuiz': 'Impossible de mettre à jour ce quiz.',

  'profile.title': 'Profil',
  'profile.pseudoLabel': 'Pseudo',
  'profile.pseudoPlaceholder': 'Ton prénom ou pseudo',
  'profile.avatarLabel': 'Avatar',
  'profile.themeLabel': 'Thème',
  'profile.themeDark': '🌙 Sombre',
  'profile.themeLight': '☀️ Clair',
  'profile.languageLabel': 'Langue',
  'profile.languageFr': '🇫🇷 Français',
  'profile.languageEn': '🇬🇧 English',
  'profile.saved': 'Profil enregistré ✓',
  'profile.errorSave': "Impossible d'enregistrer le profil. Réessayez.",
  'profile.passwordTitle': 'Mot de passe',
  'profile.newPasswordLabel': 'Nouveau mot de passe',
  'profile.confirmPasswordLabel': 'Confirmer le mot de passe',
  'profile.passwordMismatch': 'Les mots de passe ne correspondent pas.',
  'profile.errorPassword': 'Impossible de modifier le mot de passe. Réessayez.',
  'profile.passwordSaved': 'Mot de passe modifié ✓',
  'profile.changingPassword': 'Modification…',
  'profile.changePassword': 'Modifier le mot de passe',
}
