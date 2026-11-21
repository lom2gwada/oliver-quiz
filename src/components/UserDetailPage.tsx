import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { coveragePercentTenths } from '../utils/coverage'
import { longDate } from '../utils/dateFormat'
import { fetchAdminUserDetail, userStatus, visibleUserQuizzes, type AdminUserDetail, type UserDetailFailure } from '../utils/adminUsers'
import { formatPercent } from '../utils/format'
import { CoverageBar } from './CoverageBar'

/** Le contenu d'une fiche utilisateur : informations, parties par mode et quiz. Sans état ni appel réseau. */
export function UserDetailView({ detail }: { detail: AdminUserDetail }) {
  const { t, language } = useTranslation()
  const status = userStatus(detail)
  const statusLabel = { active: t('userDetail.statusActive'), disabled: t('userDetail.statusDisabled'), never: t('userDetail.statusNever') }[status]
  const date = (iso: string | null) => iso ? longDate(iso, language) : t('userDetail.none')
  const quizzes = visibleUserQuizzes(detail.quizzes)

  return <>
    <div className="users-detail-head">
      {detail.is_admin && <span className="overview-badge">{t('users.badgeAdmin')}</span>}
      {status === 'disabled' && <span className="overview-badge users-badge-disabled">{t('users.badgeDisabled')}</span>}
      {status === 'never' && <span className="overview-badge users-badge-never">{t('users.badgeNever')}</span>}
    </div>

    <h3 className="stats-group-title">{t('userDetail.infoTitle')}</h3>
    <dl className="users-info">
      <dt>{t('userDetail.email')}</dt><dd>{detail.email ?? t('users.noEmail')}</dd>
      <dt>{t('userDetail.role')}</dt><dd>{detail.is_admin ? t('userDetail.roleAdmin') : t('userDetail.rolePlayer')}</dd>
      <dt>{t('userDetail.status')}</dt><dd>{statusLabel}</dd>
      <dt>{t('userDetail.joined')}</dt><dd>{date(detail.created_at)}</dd>
      <dt>{t('userDetail.lastSignIn')}</dt><dd>{date(detail.last_sign_in_at)}</dd>
      <dt>{t('userDetail.lastPlayed')}</dt><dd>{date(detail.last_played_at)}</dd>
    </dl>

    <h3 className="stats-group-title">{t('userDetail.gamesTitle')}</h3>
    <div className="records-grid">
      <div className="record-tile"><span className="record-value">{detail.games_played}</span><span className="record-label">{t('userDetail.gamesTotal')}</span></div>
      <div className="record-tile"><span className="record-value">{detail.games.classic}</span><span className="record-label">{t('common.modeClassic')}</span></div>
      <div className="record-tile"><span className="record-value">{detail.games.streak}</span><span className="record-label">{t('common.modeStreak')}</span></div>
      <div className="record-tile"><span className="record-value">{detail.games.timed}</span><span className="record-label">{t('common.modeTimed')}</span></div>
    </div>

    <h3 className="stats-group-title">{t('userDetail.quizzesTitle')}</h3>
    <p className="mode-hint">{t('userDetail.quizzesHint')}</p>
    {quizzes.length === 0
      ? <p>{t('userDetail.quizzesNone')}</p>
      : <ul className="overview-list">
        {quizzes.map((quiz) => {
          const percent = coveragePercentTenths(quiz.seen_count, quiz.question_count)
          return <li key={quiz.quiz_id} className="overview-card users-quiz-card">
            <div className="overview-item">
              <span className="overview-item-head">
                <span className="overview-item-title">
                  {quiz.quiz_title}
                  {quiz.has_access && <span className="overview-badge users-badge-info">{t('userDetail.badgeAccess')}</span>}
                  {quiz.is_public && <span className="overview-badge users-badge-info">{t('userDetail.badgePublic')}</span>}
                </span>
                <span className="overview-item-percent">{formatPercent(percent, language, 1)}</span>
              </span>
              <CoverageBar percent={percent} label={`${quiz.quiz_title} — ${t('metric.discovered', formatPercent(percent, language, 1))}`} />
              <span className="overview-item-meta">
                {t('overview.seen', quiz.seen_count, quiz.question_count)} · {t('overview.games', quiz.games_played)}
                {quiz.last_played_at && <> · {t('overview.lastPlayed', longDate(quiz.last_played_at, language))}</>}
              </span>
            </div>
          </li>
        })}
      </ul>}
  </>
}

interface UserDetailPageProps {
  userId: string
  onBack: () => void
  /** Prévient l'appelant du pseudo dès que la fiche est chargée (fil d'Ariane). */
  onLoaded: (pseudo: string) => void
}

/** Administration : la fiche d'un utilisateur (`#/admin/utilisateurs/<id>`), en lecture seule. */
export function UserDetailPage({ userId, onBack, onLoaded }: UserDetailPageProps) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [failure, setFailure] = useState<UserDetailFailure | null>(null)

  const load = () => {
    let current = true
    setFailure(null)
    setDetail(null)
    fetchAdminUserDetail(userId)
      .then((loaded) => { if (current) { setDetail(loaded); onLoaded(loaded.pseudo) } })
      .catch((error: { failure?: UserDetailFailure }) => { if (current) setFailure(error.failure ?? 'failed') })
    return () => { current = false }
  }
  useEffect(load, [userId])

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{detail ? `${detail.avatar} ${detail.pseudo}` : t('crumb.userDetail')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    {failure === 'notFound' && <p className="alert" role="alert">{t('userDetail.notFound')}</p>}
    {failure === 'failed' && <p className="alert" role="alert">{t('userDetail.errorLoad')} <button type="button" className="secondary alert-retry" onClick={load}>{t('start.retry')}</button></p>}
    {!detail && !failure && <p>{t('common.loading')}</p>}
    {detail && <UserDetailView detail={detail} />}
  </section>
}
