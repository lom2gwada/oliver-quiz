import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { fetchQuizAuditLog } from '../utils/quizAudit'
import type { AuditEntry } from '../utils/adminUserActions'
import { AuditLogList } from './UserActionsPanel'

interface QuizAuditPanelProps {
  /** Le quiz dont on lit le journal ; `null` pour toute l'activité sur les quiz (administrateur global). */
  quizId: string | null
}

/** Le journal de gestion d'un quiz, ou de tous les quiz : qui a ajouté ou retiré un administrateur, accordé l'accès, rendu le quiz
 * public, l'a créé ou supprimé. Chaque ligne a été écrite par la base elle-même, pas par l'interface. */
export function QuizAuditPanel({ quizId }: QuizAuditPanelProps) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    setEntries(null)
    setFailed(false)
    fetchQuizAuditLog(quizId).then((rows) => { if (current) setEntries(rows) }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [quizId])

  return <>
    <p className="mode-hint">{t(quizId ? 'quizAudit.hint' : 'quizAudit.globalHint')}</p>
    {failed ? <p className="alert" role="alert">{t('quizAudit.error')}</p>
      : !entries ? <p>{t('common.loading')}</p>
      : <AuditLogList entries={entries} scope="quiz" />}
  </>
}
