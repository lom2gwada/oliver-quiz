import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from '../i18n'
import { confirmDialog } from '../utils/confirmDialog'
import { fetchAdminUsers, filterUsers, sortUsers, summarizeUsers, userStatus, DEFAULT_INACTIVITY_DAYS, INACTIVITY_DAYS, USER_FILTERS, USER_SORTS, type AdminUser, type UserFilter, type UserSort } from '../utils/adminUsers'
import { csvFilename, usersToCsv } from '../utils/adminUsersCsv'
import { longDate } from '../utils/dateFormat'
import { downloadTextFile } from '../utils/download'
import { InviteUserForm } from './InviteUserForm'
import { UsersBulkBar } from './UsersBulkBar'

interface UserListViewProps {
  users: AdminUser[]
  search: string
  filter: UserFilter
  sort: UserSort
  onSearchChange: (search: string) => void
  onFilterChange: (filter: UserFilter) => void
  onSortChange: (sort: UserSort) => void
  onOpenUser: (userId: string) => void
  /** Jours d'inactivité du filtre « inactifs depuis… » (90 par défaut). */
  inactiveDays?: number
  onInactiveDaysChange?: (days: number) => void
  /** Sélection multiple : sans ces trois propriétés, la liste n'a pas de cases à cocher. */
  selected?: ReadonlySet<string>
  onToggleUser?: (userId: string) => void
  onToggleAll?: (userIds: string[], checked: boolean) => void
  /** Lance l'export CSV de ce qui est affiché (filtres et tri appliqués). */
  onExport?: (shown: AdminUser[]) => void
  /** Contenu placé entre les compteurs et la liste (la barre d'actions en lot) ; reçoit les utilisateurs affichés. */
  renderBulk?: (shown: AdminUser[]) => ReactNode
}

/** La liste des utilisateurs avec sa recherche, son filtre, son tri, sa sélection et son export. Sans état : `UsersPage` le tient et charge les données. */
export function UserListView({ users, search, filter, sort, onSearchChange, onFilterChange, onSortChange, onOpenUser, inactiveDays = DEFAULT_INACTIVITY_DAYS, onInactiveDaysChange, selected, onToggleUser, onToggleAll, onExport, renderBulk }: UserListViewProps) {
  const { t, language } = useTranslation()
  const shown = sortUsers(filterUsers(users, search, filter, { inactiveDays }), sort)
  const summary = summarizeUsers(users)
  const narrowed = search.trim() !== '' || filter !== 'all'
  const filterLabel = { all: t('users.filterAll'), admins: t('users.filterAdmins'), creators: t('users.filterCreators'), disabled: t('users.filterDisabled'), never: t('users.filterNever'), inactive: t('users.filterInactive') }
  const sortLabel = { pseudo: t('users.sortPseudo'), created: t('users.sortCreated'), lastSignIn: t('users.sortLastSignIn'), games: t('users.sortGames') }
  const allShownSelected = !!selected && shown.length > 0 && shown.every((user) => selected.has(user.user_id))

  return <>
    <label className="question-search">{t('users.searchLabel')}
      <input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={t('users.searchPlaceholder')} />
    </label>
    <div className="users-controls">
      <label>{t('users.filterLabel')}
        <select value={filter} onChange={(event) => onFilterChange(event.target.value as UserFilter)}>
          {USER_FILTERS.map((value) => <option key={value} value={value}>{filterLabel[value]}</option>)}
        </select>
      </label>
      {filter === 'inactive' && <label>{t('users.inactiveLabel')}
        <select value={inactiveDays} onChange={(event) => onInactiveDaysChange?.(Number(event.target.value))}>
          {INACTIVITY_DAYS.map((days) => <option key={days} value={days}>{t('users.inactiveOption', days)}</option>)}
        </select>
      </label>}
      <label>{t('users.sortLabel')}
        <select value={sort} onChange={(event) => onSortChange(event.target.value as UserSort)}>
          {USER_SORTS.map((value) => <option key={value} value={value}>{sortLabel[value]}</option>)}
        </select>
      </label>
    </div>
    <p className="mode-hint question-search-count">{t('users.summary', summary.total, summary.admins, summary.disabled, summary.never)}</p>
    {narrowed && <p className="mode-hint question-search-count" role="status">{shown.length ? t('users.results', shown.length, users.length) : t('users.none')}</p>}
    {(onToggleAll || onExport) && <div className="users-list-tools">
      {onToggleAll && selected && shown.length > 0 && <label className="theme-checkbox">
        <input type="checkbox" checked={allShownSelected} onChange={(event) => onToggleAll(shown.map((user) => user.user_id), event.target.checked)} />
        {t('users.selectAll', shown.length)}
      </label>}
      {onExport && <button type="button" className="secondary" disabled={shown.length === 0} onClick={() => onExport(shown)}>{t('users.exportButton')}</button>}
    </div>}
    {renderBulk?.(shown)}
    <ul className="overview-list">
      {shown.map((user) => {
        const status = userStatus(user)
        return <li key={user.user_id} className={onToggleUser && selected ? 'overview-card users-selectable' : 'overview-card'}>
          {onToggleUser && selected && <label className="users-select">
            <input type="checkbox" checked={selected.has(user.user_id)} onChange={() => onToggleUser(user.user_id)} aria-label={t('users.selectUser', user.pseudo)} />
          </label>}
          <button type="button" className="overview-item" onClick={() => onOpenUser(user.user_id)}>
            <span className="overview-item-head">
              <span className="overview-item-id">
                <span className="users-avatar" aria-hidden="true">{user.avatar}</span>
                <span className="overview-item-title">
                  {user.pseudo}
                  {user.is_self && <span className="overview-badge users-badge-info">{t('users.badgeSelf')}</span>}
                  {user.is_admin && <span className="overview-badge">{t('users.badgeAdmin')}</span>}
                  {user.can_create_quizzes && !user.is_admin && <span className="overview-badge">{t('users.badgeCreator')}</span>}
                  {status === 'disabled' && <span className="overview-badge users-badge-disabled">{t('users.badgeDisabled')}</span>}
                  {status === 'never' && <span className="overview-badge users-badge-never">{t('users.badgeNever')}</span>}
                </span>
              </span>
              <span className="overview-item-percent">{t('overview.games', user.games_played)}</span>
            </span>
            <span className="overview-item-meta">
              {user.email ?? t('users.noEmail')} · {t('users.joined', longDate(user.created_at, language))} · {user.last_sign_in_at ? t('users.lastSignIn', longDate(user.last_sign_in_at, language)) : t('users.neverSignedIn')}
            </span>
            <span className="overview-item-action">{t('users.open')} ›</span>
          </button>
        </li>
      })}
    </ul>
  </>
}

/** Administration : la liste des utilisateurs (`#/admin/utilisateurs`). Cliquer un utilisateur ouvre sa fiche ; cocher plusieurs
 * utilisateurs permet d'agir sur eux d'un coup, et la liste affichée s'exporte en CSV. */
export function UsersPage({ onBack, onOpenUser }: { onBack: () => void; onOpenUser: (userId: string) => void }) {
  const { t, language } = useTranslation()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserFilter>('all')
  const [sort, setSort] = useState<UserSort>('pseudo')
  const [inactiveDays, setInactiveDays] = useState(DEFAULT_INACTIVITY_DAYS)
  const [inviting, setInviting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const load = () => {
    setError(false)
    fetchAdminUsers().then(setUsers).catch(() => setError(true))
  }
  useEffect(load, [])

  const toggleUser = (userId: string) => setSelected((previous) => {
    const next = new Set(previous)
    if (!next.delete(userId)) next.add(userId)
    return next
  })
  const toggleAll = (userIds: string[], checked: boolean) => setSelected((previous) => {
    const next = new Set(previous)
    for (const userId of userIds) { if (checked) next.add(userId); else next.delete(userId) }
    return next
  })

  /** Le CSV contient des adresses email : on prévient avant de le télécharger. */
  const exportCsv = async (shown: AdminUser[]) => {
    const confirmed = await confirmDialog({ title: t('users.exportConfirmTitle'), message: t('users.exportConfirm', shown.length), confirmLabel: t('users.exportConfirmLabel') })
    if (confirmed) downloadTextFile(csvFilename(new Date()), usersToCsv(shown, t, language), 'text/csv')
  }

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('users.title')}</h2>
      <div className="stats-header-actions">
        <button type="button" className="secondary" aria-expanded={inviting} onClick={() => setInviting((open) => !open)}>{t('userAccounts.inviteButton')}</button>
        <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
      </div>
    </div>
    {inviting && <InviteUserForm onInvited={load} />}
    {error && <p className="alert" role="alert">{t('users.errorLoad')} <button type="button" className="secondary alert-retry" onClick={load}>{t('start.retry')}</button></p>}
    {!users && !error && <p>{t('common.loading')}</p>}
    {users && <UserListView
      users={users} search={search} filter={filter} sort={sort} inactiveDays={inactiveDays}
      onSearchChange={setSearch} onFilterChange={setFilter} onSortChange={setSort} onInactiveDaysChange={setInactiveDays} onOpenUser={onOpenUser}
      selected={selected} onToggleUser={toggleUser} onToggleAll={toggleAll} onExport={exportCsv}
      // Une sélection que les filtres cachent ne reçoit aucune action : on n'agit que sur ce que l'on voit.
      renderBulk={(shown) => <UsersBulkBar
        selected={shown.filter((user) => selected.has(user.user_id))}
        onClear={() => setSelected(new Set())}
        onDone={(doneIds) => { setSelected((previous) => new Set([...previous].filter((id) => !doneIds.includes(id)))); load() }} />}
    />}
  </section>
}
