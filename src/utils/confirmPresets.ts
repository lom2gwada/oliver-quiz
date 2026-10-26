import type { TranslationKey } from '../i18n'
import type { ConfirmOptions } from './confirmDialog'

type Translate = (key: TranslationKey, ...args: unknown[]) => string

/** Les confirmations de l'appli, avec des libellés qui disent l'action plutôt que « OK ». Toutes sont destructives. */

/** Quitter une partie en cours : la page de la question est floutée derrière la boîte. `message` dit ce qui sera perdu
 * (la progression, la série…). */
export const abandonGameConfirm = (t: Translate, message: string): ConfirmOptions => ({
  title: t('confirm.abandonTitle'), message, confirmLabel: t('confirm.abandonGame'), cancelLabel: t('confirm.keepPlaying'), destructive: true, blur: true,
})

export const deleteQuestionConfirm = (t: Translate): ConfirmOptions => ({
  title: t('confirm.deleteQuestionTitle'), message: t('admin.confirmDeleteQuestion'), confirmLabel: t('confirm.deleteQuestion'), destructive: true,
})

export const deleteGuestLinkConfirm = (t: Translate): ConfirmOptions => ({
  title: t('confirm.deleteGuestLinkTitle'), message: t('admin.confirmDeleteGuestLink'), confirmLabel: t('confirm.deleteGuestLink'), destructive: true,
})

export const leaveProfileConfirm = (t: Translate): ConfirmOptions => ({
  title: t('confirm.leaveProfileTitle'), message: t('profile.confirmLeave'), confirmLabel: t('confirm.leaveProfile'), cancelLabel: t('confirm.stayOnProfile'), destructive: true,
})

export const deleteAccountConfirm = (t: Translate): ConfirmOptions => ({
  title: t('confirm.deleteAccountTitle'), message: t('profile.deleteConfirm'), confirmLabel: t('confirm.deleteAccount'), destructive: true,
})
