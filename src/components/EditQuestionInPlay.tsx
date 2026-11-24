import { useEffect, useRef, useState } from 'react'
import type { Category, Question } from '../types/quiz'
import { useTranslation } from '../i18n'
import { QuestionEditForm } from './QuestionEditForm'

interface EditQuestionDialogProps {
  question: Question
  themes: Category[]
  /** Enregistre la question ; rejette avec un message à montrer si le quiz refuse la modification. */
  onSave: (updated: Question) => Promise<void>
  onClose: () => void
}

/** Le formulaire d'édition d'une question dans une fenêtre modale (`<dialog>` : le reste de la page est inerte, le focus reste dans
 * la fenêtre, Échap la ferme). Un clic à côté ne la ferme pas : le formulaire est long, on ne veut pas le perdre par un clic maladroit.
 * Elle reste ouverte tant que l'enregistrement échoue, avec la raison du refus. */
export function EditQuestionDialog({ question, themes, onSave, onClose }: EditQuestionDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '') }
    return () => { if (dialog.open && typeof dialog.close === 'function') dialog.close() }
  }, [])

  const save = async (updated: Question) => {
    setError('')
    try {
      await onSave(updated)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : t('admin.errorSaveQuestion'))
    }
  }

  return <dialog ref={dialogRef} className="question-edit-dialog" aria-labelledby="question-edit-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="question-edit-dialog-body">
      <h2 id="question-edit-dialog-title">{t('play.editTitle')}</h2>
      <p className="mode-hint">{t('play.editHint')}</p>
      <QuestionEditForm question={question} themes={themes} error={error} onSave={save} onCancel={onClose} />
    </div>
  </dialog>
}

interface EditQuestionInPlayProps {
  /** La question telle qu'elle est enregistrée dans le quiz (réponses dans l'ordre de l'auteur, pas dans l'ordre mélangé de la partie). */
  question: Question
  themes: Category[]
  onSave: (updated: Question) => Promise<void>
  /** Prévient la page de jeu que la fenêtre s'ouvre ou se ferme, pour qu'elle suspende ses chronomètres. */
  onOpenChange: (open: boolean) => void
}

/** Le bouton « Modifier » d'une page de jeu et la fenêtre qu'il ouvre. Réservé aux administrateurs du quiz : c'est la page qui
 * décide de l'afficher ; les droits eux-mêmes sont contrôlés en base à l'enregistrement. */
export function EditQuestionInPlay({ question, themes, onSave, onOpenChange }: EditQuestionInPlayProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const change = (next: boolean) => { setOpen(next); onOpenChange(next) }
  return <>
    <button type="button" className="secondary edit-question-button" onClick={() => change(true)}>✏️ {t('play.editQuestion')}</button>
    {open && <EditQuestionDialog question={question} themes={themes} onSave={onSave} onClose={() => change(false)} />}
  </>
}
