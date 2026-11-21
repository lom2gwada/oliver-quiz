import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { fetchAdminUsers, filterUsers, sortUsers, summarizeUsers, userStatus, USER_FILTERS, USER_SORTS, type AdminUser, type UserFilter, type UserSort } from '../utils/adminUsers'
import { longDate } from '../utils/dateFormat'

interface UserListViewProps {
  users: AdminUser[]
  search: string
  filter: UserFilter
  sort: UserSort
  onSearchChange: (search: string) => void
  onFilterChange: (filter: UserFilter) => void
  onSortChange: (sort: UserSort) => void
  onOpenUser: (userId: string) => void
}

/** La liste des utilisateurs avec sa recherche, son filtre et son tri. Sans état : `UsersPage` le tient et charge les données. */
export function UserListView({ users, search, filter, sort, onSearchChange, onFilterChange, onSortChange, onOpenUser }: UserListViewProps) {
  const { t, language } = useTranslation()
  const shown = sortUsers(filterUsers(users, search, filter), sort)
  const summary = summarizeUsers(users)
  const narrowed = search.trim() !== '' || filter !== 'all'
  const filterLabel = { all: t('users.filterAll'), admins: t('users.filterAdmins'), disabled: t('users.filterDisabled'), never: t('users.filterNever') }
  const sortLabel = { pseudo: t('users.sortPseudo'), created: t('users.sortCreated'), lastSignIn: t('users.sortLastSignIn'), games: t('users.sortGames') }

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
      <label>{t('users.sortLabel')}
        <select value={sort} onChange={(event) => onSortChange(event.target.value as UserSort)}>
          {USER_SORTS.map((value) => <option key={value} value={value}>{sortLabel[value]}</option>)}
        </select>
      </label>
    </div>
    <p className="mode-hint question-search-count">{t('users.summary', summary.total, summary.admins, summary.disabled, summary.never)}</p>
    {narrowed && <p className="mode-hint question-search-count" role="status">{shown.length ? t('users.results', shown.length, users.length) : t('users.none')}</p>}
    <ul className="overview-list">
      {shown.map((user) => {
        const status = userStatus(user)
        return <li key={user.user_id} className="overview-card">
          <button type="button" className="overview-item" onClick={() => onOpenUser(user.user_id)}>
            <span className="overview-item-head">
              <span className="overview-item-id">
                <span className="users-avatar" aria-hidden="true">{user.avatar}</span>
                <span className="overview-item-title">
                  {user.pseudo}
                  {user.is_self && <span className="overview-badge users-badge-info">{t('users.badgeSelf')}</span>}
                  {user.is_admin && <span className="overview-badge">{t('users.badgeAdmin')}</span>}
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

/** Administration : la liste des utilisateurs (`#/admin/utilisateurs`), en lecture seule. Cliquer un utilisateur ouvre sa fiche. */
export function UsersPage({ onBack, onOpenUser }: { onBack: () => void; onOpenUser: (userId: string) => void }) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserFilter>('all')
  const [sort, setSort] = useState<UserSort>('pseudo')

  const load = () => {
    setError(false)
    fetchAdminUsers().then(setUsers).catch(() => setError(true))
  }
  useEffect(load, [])

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('users.title')}</h2>
      <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
    </div>
    {error && <p className="alert" role="alert">{t('users.errorLoad')} <button type="button" className="secondary alert-retry" onClick={load}>{t('start.retry')}</button></p>}
    {!users && !error && <p>{t('common.loading')}</p>}
    {users && <UserListView users={users} search={search} filter={filter} sort={sort} onSearchChange={setSearch} onFilterChange={setFilter} onSortChange={setSort} onOpenUser={onOpenUser} />}
  </section>
}
