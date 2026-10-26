import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n'
import { CONFIRMING_CLASS, getPendingConfirm, settleConfirm, subscribeConfirm } from '../utils/confirmDialog'

/** Affiche les confirmations demandées par `confirmDialog`, dans un `<dialog>` modal : le reste de la page est inerte,
 * le focus reste dans la boîte, Échap (ou un clic à côté) annule. Sur une action destructive le focus part sur
 * « Annuler », pour qu'Entrée ne détruise rien par réflexe. Une seule instance, montée une fois dans l'appli. */
export function ConfirmHost() {
  const { t } = useTranslation()
  const pending = useSyncExternalStore(subscribeConfirm, getPendingConfirm)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!pending || !dialog) return
    const root = document.getElementById('root') ?? document.body
    if (pending.options.blur) root.classList.add(CONFIRMING_CLASS)
    if (!dialog.open) dialog.showModal()
    ;(pending.options.destructive ? cancelRef : confirmRef).current?.focus()
    return () => {
      root.classList.remove(CONFIRMING_CLASS)
      if (dialog.open) dialog.close()
    }
  }, [pending])

  // Si l'appli disparaît avec une question en attente (déconnexion), elle est refusée plutôt que de rester suspendue.
  useEffect(() => () => settleConfirm(false), [])

  if (!pending) return null
  const { options } = pending
  // Rendu dans `body`, hors de `#root` : le flou posé sur `#root` ne doit pas atteindre la boîte elle-même.
  return createPortal(
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onCancel={(event) => { event.preventDefault(); settleConfirm(false) }}
      onClick={(event) => { if (event.target === event.currentTarget) settleConfirm(false) }}
    >
      <div className="confirm-body">
        <h2 id="confirm-title">{options.title ?? t('confirm.title')}</h2>
        <p id="confirm-message">{options.message}</p>
        <div className="confirm-actions">
          <button type="button" className="secondary" ref={cancelRef} onClick={() => settleConfirm(false)}>{options.cancelLabel ?? t('common.cancel')}</button>
          <button type="button" className={options.destructive ? 'danger' : undefined} ref={confirmRef} onClick={() => settleConfirm(true)}>{options.confirmLabel}</button>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
