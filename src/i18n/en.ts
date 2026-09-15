import type { GameMode } from '../types/quiz'
import type { TranslationKey } from './index'

/** Dictionnaire anglais. `satisfies` garantit à la compilation qu'aucune clé de `fr.ts` n'est oubliée ici
 * (et qu'aucune clé en trop n'y traîne). Les fonctions reproduisent le sens dans un anglais idiomatique,
 * avec leurs propres règles de pluriel — pas une traduction mot à mot. */
export const en = {
  'common.back': 'Back',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.logout': 'Log out',
  'common.viewHistory': '🕓 History',
  'common.viewLeaderboard': '🏆 Leaderboard',
  'common.modeClassic': '🎯 Classic',
  'common.modeStreak': '🔥 Streak',
  'common.modeTimed': '⏱️ Time attack',

  'nav.profile': '👤 Profile',
  'nav.quiz': '⚙️ Quiz',
  'nav.muteSound': 'Mute sound',
  'nav.unmuteSound': 'Unmute sound',
  'nav.by': (author: string) => `by ${author}`,

  'start.quizLabel': 'Quiz',
  'start.modeGroupLabel': 'Game mode',
  'start.questionCountLabel': 'Number of questions',
  'start.questionCountOption': (count: number, unavailable: boolean) =>
    `${count} question${count !== 1 ? 's' : ''}${unavailable ? ' (unavailable)' : ''}`,
  'start.allQuestionsOption': (count: number) => `All questions (${count})`,
  'start.streakHint': 'Answer correctly in a row, no time limit: the run ends at the first mistake.',
  'start.durationLabel': 'Duration',
  'start.durationOption': (minutes: number) => minutes === 0 ? 'Unlimited' : `${minutes} minutes`,
  'start.timerToggle': '⏳ Timer per question',
  'start.availability': (count: number, mode: GameMode, drawn: number) => {
    const base = `${count} question${count !== 1 ? 's' : ''} available`
    if (mode === 'classic') return `${base} — ${drawn} will be drawn at random.`
    if (mode === 'timed') return `${base} — they may repeat if time allows.`
    return `${base}.`
  },
  'start.startClassic': 'Start the quiz',
  'start.startStreak': 'Start the streak',
  'start.startTimed': 'Start the timer',
  'start.confirmAbandon': 'Abandon the current run? Your progress will be lost.',

  'admin.errorLoadQuiz': 'Could not load this quiz.',
  'admin.errorDuplicateTitle': 'A quiz with this title already exists.',
  'admin.errorCreateQuiz': 'Could not create this quiz.',
  'admin.errorInvalidJson': 'Invalid JSON file.',
  'admin.errorSaveQuestion': 'Could not save this question.',
  'admin.errorAddQuestion': 'Could not add this question.',
  'admin.confirmDeleteQuestion': 'Permanently delete this question?',
  'admin.errorDeleteQuestion': 'Could not delete this question.',
  'admin.errorDuplicateTheme': 'A theme with this name already exists.',
  'admin.errorAddTheme': 'Could not add this theme.',
  'admin.errorDuplicateTitleOther': 'Another quiz already has this title.',
  'admin.errorUpdateQuiz': 'Could not update this quiz.',

  'profile.title': 'Profile',
  'profile.pseudoLabel': 'Nickname',
  'profile.pseudoPlaceholder': 'Your first name or nickname',
  'profile.avatarLabel': 'Avatar',
  'profile.themeLabel': 'Theme',
  'profile.themeDark': '🌙 Dark',
  'profile.themeLight': '☀️ Light',
  'profile.languageLabel': 'Language',
  'profile.languageFr': '🇫🇷 Français',
  'profile.languageEn': '🇬🇧 English',
  'profile.saved': 'Profile saved ✓',
  'profile.errorSave': 'Could not save the profile. Please try again.',
  'profile.passwordTitle': 'Password',
  'profile.newPasswordLabel': 'New password',
  'profile.confirmPasswordLabel': 'Confirm password',
  'profile.passwordMismatch': 'Passwords do not match.',
  'profile.errorPassword': 'Could not change the password. Please try again.',
  'profile.passwordSaved': 'Password changed ✓',
  'profile.changingPassword': 'Changing…',
  'profile.changePassword': 'Change password',
} satisfies Record<TranslationKey, string | ((...args: never[]) => string)>
