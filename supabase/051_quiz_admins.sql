-- Administration par quiz (#241) : chaque quiz a ses propriétaires et ses administrateurs, en plus de l'administrateur global
-- (`profiles.is_admin`, qui garde la main sur tous les quiz).
--
-- Deux rôles par quiz (`quiz_admins.role`) :
--   * `owner` (propriétaire) : le créateur, plus ceux qu'un propriétaire promeut ;
--   * `admin` (administrateur) : tous les droits de gestion du quiz, SAUF rendre le quiz public, gérer la liste des
--     administrateurs et supprimer le quiz, réservés aux propriétaires.
--
-- Droits : contenu, accès, liens invités et leurs résultats = administrateur du quiz ; public, liste des administrateurs,
-- suppression = propriétaire ; tout = administrateur global.
--
-- Les ÉCRITURES sur `quizzes` ne passent plus que par des fonctions `security definer` (`upsert_quiz`, `update_quiz`,
-- `set_quiz_public`, `delete_quiz`) : un administrateur de quiz n'a AUCUNE policy d'écriture directe sur la table, donc ne peut
-- ni changer `is_public` ni supprimer le quiz en contournant l'interface, ni écraser le travail d'un autre (`update_quiz`
-- refuse si le quiz a changé depuis son chargement). L'administrateur global garde sa policy d'écriture directe (016).
--
-- La lecture reste régie par la RLS (accès accordé, quiz public, administrateur du quiz). Les fonctions `is_quiz_admin` et
-- `is_quiz_owner` sont `security definer`, comme `is_admin()` : une policy qui interrogerait `quiz_admins` directement
-- retomberait sur la RLS de cette table (même piège que 016 pour `profiles`, et 039 pour `quiz_access`).
--
-- Vie privée : un administrateur de quiz ne peut pas lire `profiles`. Il cherche un compte par PSEUDO (début de pseudo ou de
-- mot, au moins 2 caractères, 10 résultats au plus) dans un quiz qu'il administre ; la réponse ne contient que le pseudo et
-- l'avatar, jamais l'email.
--
-- Suppression de compte (`delete_my_account`, `admin_delete_user`) : refusée (`sole_quiz_owner`) si le compte est le seul
-- propriétaire d'un quiz ; il faut d'abord nommer un autre propriétaire ou supprimer le quiz.
--
-- Le journal d'audit de ces actions est l'objet du ticket #244.

-- ============================================================================================================
-- Table
-- ============================================================================================================

create table public.quiz_admins (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

create index quiz_admins_user_idx on public.quiz_admins (user_id);

alter table public.quiz_admins enable row level security;

-- Lecture seule pour les clients : chacun voit ses propres lignes (de quoi savoir quels quiz il administre) et l'administrateur
-- global voit tout. La liste détaillée (pseudos) passe par `quiz_admins_list`. Aucune écriture directe.
create policy "Users can see the quizzes they administer, global admins see all"
  on public.quiz_admins for select
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.quiz_admins from anon, authenticated;
grant select on public.quiz_admins to authenticated;

-- ============================================================================================================
-- Qui peut quoi
-- ============================================================================================================

-- Administrateur du quiz (propriétaire ou administrateur), ou administrateur global.
create or replace function public.is_quiz_admin(p_quiz_id uuid) returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select public.is_admin()
    or exists (select 1 from public.quiz_admins where quiz_id = p_quiz_id and user_id = auth.uid())
$$;

-- Propriétaire du quiz, ou administrateur global.
create or replace function public.is_quiz_owner(p_quiz_id uuid) returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select public.is_admin()
    or exists (select 1 from public.quiz_admins where quiz_id = p_quiz_id and user_id = auth.uid() and role = 'owner')
$$;

-- Utilisées dans des policies : `anon` doit pouvoir les évaluer (elles répondent `false`) sans erreur de droit.
revoke all on function public.is_quiz_admin(uuid) from public;
revoke all on function public.is_quiz_owner(uuid) from public;
grant execute on function public.is_quiz_admin(uuid) to anon, authenticated;
grant execute on function public.is_quiz_owner(uuid) to anon, authenticated;

-- ============================================================================================================
-- Reprise de l'existant et propriétaire à la création
-- ============================================================================================================

-- Le créateur de chaque quiz en devient propriétaire. Un quiz sans `created_by` (auteur supprimé) n'a pas de propriétaire :
-- seul l'administrateur global le gère, jusqu'à ce qu'il en nomme un.
insert into public.quiz_admins (quiz_id, user_id, role, added_by)
select q.id, q.created_by, 'owner', q.created_by
from public.quizzes q
where q.created_by is not null and exists (select 1 from auth.users u where u.id = q.created_by)
on conflict do nothing;

create or replace function public.quizzes_add_creator_as_owner() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.quiz_admins (quiz_id, user_id, role, added_by)
    values (new.id, new.created_by, 'owner', new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger quizzes_creator_becomes_owner
  after insert on public.quizzes
  for each row execute function public.quizzes_add_creator_as_owner();

-- ============================================================================================================
-- RLS : lecture par les administrateurs du quiz
-- ============================================================================================================

drop policy "Users can view quizzes they have access to, public ones, admins see all" on public.quizzes;

create policy "Users can view quizzes they have access to, public ones, or administer"
  on public.quizzes for select
  using (
    exists (select 1 from public.quiz_access qa where qa.quiz_id = quizzes.id and qa.user_id = auth.uid())
    or quizzes.is_public
    or public.is_quiz_admin(quizzes.id)
  );

-- L'administrateur d'un quiz voit qui y a accès (les écritures passent par `admin_set_user_quiz_access`).
create policy "Quiz admins can view who has access to their quizzes"
  on public.quiz_access for select
  using (public.is_quiz_admin(quiz_id));

-- Liens invités et leurs résultats : l'administrateur du quiz concerné, plus l'administrateur global.
drop policy "Admins can manage guest links" on public.guest_links;
create policy "Quiz admins can manage the guest links of their quizzes"
  on public.guest_links for all
  using (public.is_quiz_admin(quiz_id))
  with check (public.is_quiz_admin(quiz_id));

drop policy "Admins can view guest results" on public.guest_results;
create policy "Quiz admins can view the guest results of their quizzes"
  on public.guest_results for select
  using (exists (select 1 from public.guest_links gl where gl.token = guest_results.token and public.is_quiz_admin(gl.quiz_id)));

-- ============================================================================================================
-- Écriture d'un quiz : créer / remplacer, modifier, rendre public, supprimer
-- ============================================================================================================

-- Crée le quiz s'il n'existe pas (réservé à l'administrateur global pour l'instant, #243 ouvrira la création), sinon remplace
-- son contenu par titre (import d'un fichier) : réservé à ses administrateurs. N'accorde jamais d'accès. Renvoie l'id.
create or replace function public.upsert_quiz(p_title text, p_content jsonb) returns uuid
  language plpgsql security definer
  set search_path = public
as $$
declare
  existing uuid;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into existing from public.quizzes where title = p_title;
  if found then
    if not public.is_quiz_admin(existing) then raise exception 'forbidden' using errcode = '42501'; end if;
    update public.quizzes set content = p_content, updated_at = clock_timestamp() where id = existing;
    return existing;
  end if;
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.quizzes (title, content, created_by) values (p_title, p_content, auth.uid()) returning id into new_id;
  return new_id;
end;
$$;

-- Modifie un quiz existant par id (titre et contenu). `p_expected_updated_at` est la version que l'appelant a chargée :
-- si le quiz a changé depuis, rien n'est écrit (`conflict`), pour qu'un administrateur n'écrase pas le travail d'un autre.
-- Renvoie la nouvelle version, à passer à l'appel suivant.
create or replace function public.update_quiz(p_id uuid, p_title text, p_content jsonb, p_expected_updated_at timestamptz) returns timestamptz
  language plpgsql security definer
  set search_path = public
as $$
declare
  current_version timestamptz;
  new_version timestamptz := clock_timestamp();
begin
  if not public.is_quiz_admin(p_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select updated_at into current_version from public.quizzes where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_expected_updated_at is not null and current_version <> p_expected_updated_at then raise exception 'conflict'; end if;
  update public.quizzes set title = p_title, content = p_content, updated_at = new_version where id = p_id;
  return new_version;
end;
$$;

-- Rend un quiz visible de tous les comptes (ou retire cette visibilité) : propriétaire. Ne change pas la version du contenu
-- (basculer la visibilité ne doit pas faire échouer l'enregistrement d'un administrateur qui édite en même temps).
create or replace function public.set_quiz_public(p_quiz_id uuid, p_is_public boolean) returns void
  language plpgsql security definer
  set search_path = public
as $$
begin
  if not public.is_quiz_owner(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.quizzes set is_public = p_is_public where id = p_quiz_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end;
$$;

-- Supprime un quiz : propriétaire. Les accès, les liens invités et la progression de révision partent avec (clés étrangères
-- `on delete cascade`) ; l'historique des parties reste, sous son titre, sauf si `p_purge_history` : on l'efface alors pour
-- les quatre modes (parties de ce quiz, et celles d'un quiz de même titre déjà supprimé, restées sans `quiz_id`). C'est le
-- SEUL moyen, pour un propriétaire qui n'est pas administrateur global, d'effacer des parties de joueurs.
create or replace function public.delete_quiz(p_quiz_id uuid, p_purge_history boolean default false) returns jsonb
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_title text;
  n_classic int := 0;
  n_questions int := 0;
  n_streak int := 0;
  n_timed int := 0;
begin
  if not public.is_quiz_owner(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select title into v_title from public.quizzes where id = p_quiz_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  if p_purge_history then
    delete from public.quiz_results where quiz_id = p_quiz_id or (quiz_id is null and quiz_title = v_title);
    get diagnostics n_classic = row_count;
    delete from public.question_results where quiz_id = p_quiz_id or (quiz_id is null and quiz_title = v_title);
    get diagnostics n_questions = row_count;
    delete from public.streak_results where quiz_id = p_quiz_id or (quiz_id is null and quiz_title = v_title);
    get diagnostics n_streak = row_count;
    delete from public.timed_results where quiz_id = p_quiz_id or (quiz_id is null and quiz_title = v_title);
    get diagnostics n_timed = row_count;
  end if;
  delete from public.quizzes where id = p_quiz_id;
  return jsonb_build_object('quiz_results', n_classic, 'question_results', n_questions, 'streak_results', n_streak, 'timed_results', n_timed);
end;
$$;

-- ============================================================================================================
-- Gérer les administrateurs d'un quiz
-- ============================================================================================================

-- Refuse si `p_target` est propriétaire et qu'aucun AUTRE propriétaire ne resterait (`last_owner`).
create or replace function public.quiz_assert_other_owner_remains(p_quiz_id uuid, p_target uuid) returns void
  language plpgsql stable security definer
  set search_path = public
as $$
begin
  if exists (select 1 from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_target and role = 'owner')
     and not exists (select 1 from public.quiz_admins where quiz_id = p_quiz_id and user_id <> p_target and role = 'owner') then
    raise exception 'last_owner';
  end if;
end;
$$;

-- Ajoute un compte comme administrateur (`admin`) ou propriétaire (`owner`) du quiz, ou change le rôle d'un membre existant
-- (promotion, rétrogradation) : propriétaire. Le compte doit exister et ne pas être désactivé. Sans effet si le rôle est déjà
-- le bon. Jamais le dernier propriétaire (`last_owner`).
create or replace function public.quiz_set_admin_role(p_quiz_id uuid, p_user_id uuid, p_role text) returns void
  language plpgsql security definer
  set search_path = public, auth
as $$
declare
  is_banned boolean;
  member_role text;
begin
  if not public.is_quiz_owner(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('owner', 'admin') then raise exception 'invalid_role'; end if;
  -- Verrou sur le quiz : deux propriétaires qui se rétrogradent l'un l'autre en même temps passent l'un après l'autre.
  perform 1 from public.quizzes where id = p_quiz_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select coalesce(u.banned_until > now(), false) into is_banned
  from public.profiles p join auth.users u on u.id = p.id where p.id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  select role into member_role from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_user_id;
  if member_role is null and is_banned then raise exception 'user_disabled'; end if;
  if member_role = p_role then return; end if;
  if member_role = 'owner' and p_role = 'admin' then perform public.quiz_assert_other_owner_remains(p_quiz_id, p_user_id); end if;

  insert into public.quiz_admins (quiz_id, user_id, role, added_by) values (p_quiz_id, p_user_id, p_role, auth.uid())
  on conflict (quiz_id, user_id) do update set role = excluded.role;
end;
$$;

-- Retire un administrateur ou un propriétaire : propriétaire. Un administrateur (pas propriétaire) peut aussi se retirer
-- lui-même. Jamais le dernier propriétaire (`last_owner`), y compris pour soi. Sans effet si le compte n'en est pas membre.
create or replace function public.quiz_remove_admin(p_quiz_id uuid, p_user_id uuid) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  member_role text;
begin
  if not (
    public.is_quiz_owner(p_quiz_id)
    or (p_user_id = auth.uid() and exists (select 1 from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_user_id))
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform 1 from public.quizzes where id = p_quiz_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  select role into member_role from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_user_id;
  if member_role is null then return; end if;
  if member_role = 'owner' then perform public.quiz_assert_other_owner_remains(p_quiz_id, p_user_id); end if;
  delete from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_user_id;
end;
$$;

-- Les propriétaires et administrateurs d'un quiz (propriétaires d'abord), pour le panneau « Administrateurs ». Pseudos seulement.
create or replace function public.quiz_admins_list(p_quiz_id uuid) returns jsonb
  language plpgsql stable security definer
  set search_path = public, auth
as $$
begin
  if not public.is_quiz_admin(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', qa.user_id,
      'pseudo', p.pseudo,
      'avatar', p.avatar,
      'role', qa.role,
      'added_by_pseudo', adder.pseudo,
      'added_at', qa.added_at,
      'is_self', qa.user_id = auth.uid(),
      'disabled', coalesce(u.banned_until > now(), false)
    ) order by (qa.role = 'owner') desc, qa.added_at, lower(p.pseudo), qa.user_id)
    from public.quiz_admins qa
    join public.profiles p on p.id = qa.user_id
    join auth.users u on u.id = qa.user_id
    left join public.profiles adder on adder.id = qa.added_by
    where qa.quiz_id = p_quiz_id
  ), '[]'::jsonb);
end;
$$;

-- Les comptes qui ont accès au quiz (pseudo et avatar), pour qu'un administrateur de quiz sache à qui il l'a accordé sans lire `profiles`.
create or replace function public.quiz_access_users(p_quiz_id uuid) returns jsonb
  language plpgsql stable security definer
  set search_path = public
as $$
begin
  if not public.is_quiz_admin(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', p.id, 'pseudo', p.pseudo, 'avatar', p.avatar) order by lower(p.pseudo), p.id)
    from public.quiz_access qa join public.profiles p on p.id = qa.user_id
    where qa.quiz_id = p_quiz_id
  ), '[]'::jsonb);
end;
$$;

-- Cherche un compte par pseudo pour l'ajouter comme administrateur ou lui accorder l'accès à ce quiz : début du pseudo ou d'un
-- de ses mots, 2 caractères au moins, 10 résultats au plus, comptes désactivés exclus. Ni email ni liste complète.
create or replace function public.quiz_search_users(p_quiz_id uuid, p_query text) returns jsonb
  language plpgsql stable security definer
  set search_path = public, auth
as $$
declare
  q text := btrim(coalesce(p_query, ''));
begin
  if not public.is_quiz_admin(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return coalesce((
    select jsonb_agg(row_to_json(found_users)::jsonb order by lower(found_users.pseudo), found_users.user_id)
    from (
      select p.id as user_id, p.pseudo, p.avatar, qa.role,
             exists (select 1 from public.quiz_access a where a.quiz_id = p_quiz_id and a.user_id = p.id) as has_access
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.quiz_admins qa on qa.quiz_id = p_quiz_id and qa.user_id = p.id
      where not coalesce(u.banned_until > now(), false)
        and (p.pseudo ilike (q || '%') or p.pseudo ilike ('% ' || q || '%'))
      order by lower(p.pseudo), p.id
      limit 10
    ) found_users
  ), '[]'::jsonb);
end;
$$;

-- ============================================================================================================
-- Accès aux quiz : ouvert aux administrateurs du quiz (048 le réservait à l'administrateur global)
-- ============================================================================================================

create or replace function public.admin_set_user_quiz_access(p_user_id uuid, p_quiz_id uuid, p_granted boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_pseudo text;
  quiz_title text;
  changed int;
begin
  if not public.is_quiz_admin(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select pseudo into target_pseudo from public.profiles where id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select title into quiz_title from public.quizzes where id = p_quiz_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  if p_granted then
    insert into public.quiz_access (quiz_id, user_id) values (p_quiz_id, p_user_id) on conflict do nothing;
  else
    delete from public.quiz_access where quiz_id = p_quiz_id and user_id = p_user_id;
  end if;
  get diagnostics changed = row_count;
  if changed = 0 then return; end if;
  perform public.admin_audit(case when p_granted then 'grant_access' else 'revoke_access' end, p_user_id, target_pseudo,
    jsonb_build_object('quiz_id', p_quiz_id, 'quiz_title', quiz_title));
end;
$$;

-- ============================================================================================================
-- Suppression de compte : jamais le seul propriétaire d'un quiz
-- ============================================================================================================

create or replace function public.assert_not_sole_quiz_owner(p_user_id uuid) returns void
  language plpgsql stable security definer
  set search_path = public
as $$
declare
  titles text;
begin
  select string_agg(q.title, E'\n' order by q.title) into titles
  from public.quiz_admins qa
  join public.quizzes q on q.id = qa.quiz_id
  where qa.user_id = p_user_id and qa.role = 'owner'
    and not exists (select 1 from public.quiz_admins other where other.quiz_id = qa.quiz_id and other.role = 'owner' and other.user_id <> p_user_id);
  if titles is not null then raise exception 'sole_quiz_owner' using detail = titles; end if;
end;
$$;

revoke all on function public.assert_not_sole_quiz_owner(uuid) from public, anon, authenticated;
revoke all on function public.quiz_assert_other_owner_remains(uuid, uuid) from public, anon, authenticated;

-- « Supprimer mon compte » (036) : mêmes règles qu'avant, plus le refus du seul propriétaire d'un quiz.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = uid and is_admin)
     and not exists (select 1 from public.profiles where is_admin and id <> uid) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  perform public.assert_not_sole_quiz_owner(uid);
  update public.quizzes set created_by = null where created_by = uid;
  update public.guest_links set created_by = null where created_by = uid;
  delete from auth.users where id = uid;
end;
$$;

-- Suppression d'un compte par l'administrateur (048) : idem.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_pseudo text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select pseudo into target_pseudo from public.profiles where id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_user_id = auth.uid() then raise exception 'self_forbidden'; end if;
  perform public.admin_assert_other_admin_remains(p_user_id);
  perform public.assert_not_sole_quiz_owner(p_user_id);

  perform public.admin_audit('delete_user', p_user_id, target_pseudo);
  update public.quizzes set created_by = null where created_by = p_user_id;
  update public.guest_links set created_by = null where created_by = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

-- ============================================================================================================
-- Droits d'exécution : connectés seulement (jamais `anon`)
-- ============================================================================================================

revoke all on function public.upsert_quiz(text, jsonb) from public, anon;
revoke all on function public.update_quiz(uuid, text, jsonb, timestamptz) from public, anon;
revoke all on function public.set_quiz_public(uuid, boolean) from public, anon;
revoke all on function public.delete_quiz(uuid, boolean) from public, anon;
revoke all on function public.quiz_set_admin_role(uuid, uuid, text) from public, anon;
revoke all on function public.quiz_remove_admin(uuid, uuid) from public, anon;
revoke all on function public.quiz_admins_list(uuid) from public, anon;
revoke all on function public.quiz_access_users(uuid) from public, anon;
revoke all on function public.quiz_search_users(uuid, text) from public, anon;
grant execute on function public.upsert_quiz(text, jsonb) to authenticated;
grant execute on function public.update_quiz(uuid, text, jsonb, timestamptz) to authenticated;
grant execute on function public.set_quiz_public(uuid, boolean) to authenticated;
grant execute on function public.delete_quiz(uuid, boolean) to authenticated;
grant execute on function public.quiz_set_admin_role(uuid, uuid, text) to authenticated;
grant execute on function public.quiz_remove_admin(uuid, uuid) to authenticated;
grant execute on function public.quiz_admins_list(uuid) to authenticated;
grant execute on function public.quiz_access_users(uuid) to authenticated;
grant execute on function public.quiz_search_users(uuid, text) to authenticated;
