-- Actions de l'administrateur sur un utilisateur (#230) : désactiver / réactiver, modifier le profil, rôle, accès aux quiz,
-- réinitialiser la progression, supprimer — et le journal d'audit de tout cela.
--
-- Toutes passent par des fonctions `security definer` qui commencent par `is_admin()` (aucun droit pour `anon` ni `public`) :
-- le client ne peut ni écrire dans `auth.users` ni changer `is_admin` (046). Les garde-fous sont ICI, en base, pas seulement
-- dans l'interface :
--   * on ne désactive, ne rétrograde ni ne supprime SON PROPRE compte (`self_forbidden`) ;
--   * on ne retire jamais le dernier administrateur actif, ni par désactivation, ni par rétrogradation, ni par suppression
--     (`last_admin`) — contrôle redondant avec le précédent tant que l'appelant est admin, mais il tient aussi pour un admin
--     dont le compte vient d'être bloqué et dont le jeton court encore.
-- Une action sans effet (déjà désactivé, accès déjà accordé…) ne fait rien et n'écrit pas dans le journal.
--
-- ATTENTION : le projet Supabase est partagé avec Quiz Forge et Periodic Quiz (tables `quiz_forge_*` et `periodic_*`, toutes
-- `on delete cascade` vers `auth.users`). Un compte est donc COMMUN aux trois applications : le désactiver l'empêche de se
-- connecter à toutes, et le supprimer emporte aussi ses données dans les deux autres (comme `delete_my_account()`, 036).
-- Seule la réinitialisation de la progression est propre à Oliver Quiz.
--
-- « Désactiver » = `auth.users.banned_until` dans 100 ans (le serveur d'authentification refuse alors la connexion et le
-- renouvellement du jeton) + suppression de ses sessions. Un jeton d'accès déjà émis reste utilisable jusqu'à son expiration
-- (durée de vie réglée dans le dashboard Auth, 1 h par défaut) : c'est le délai maximum avant que le blocage soit total.
--
-- Journal : `admin_audit_log`, sans clé étrangère (une ligne survit à la suppression de l'administrateur comme de la cible) et
-- avec le pseudo de chacun au moment des faits. Aucun email n'y est conservé : après une suppression de compte il ne
-- resterait qu'une donnée personnelle sans objet. Lecture réservée aux administrateurs ; aucune écriture directe possible.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid not null,
  admin_pseudo text not null default '',
  target_id uuid not null,
  target_pseudo text not null default '',
  action text not null check (action in ('disable', 'enable', 'update_profile', 'set_admin', 'reset_progress', 'delete_user', 'grant_access', 'revoke_access')),
  details jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_id, created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "Admins can read the audit log" on public.admin_audit_log;
create policy "Admins can read the audit log"
  on public.admin_audit_log for select
  using (public.is_admin());

-- Lecture seule pour les clients (filtrée par la politique ci-dessus) : le journal ne s'écrit que par les fonctions ci-dessous.
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

-- Fonctions internes, appelées seulement par les fonctions d'administration (jamais directement par un client).
create or replace function public.admin_audit(p_action text, p_target_id uuid, p_target_pseudo text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_pseudo text;
begin
  select pseudo into actor_pseudo from public.profiles where id = auth.uid();
  insert into public.admin_audit_log (admin_id, admin_pseudo, target_id, target_pseudo, action, details)
  values (auth.uid(), coalesce(actor_pseudo, ''), p_target_id, coalesce(p_target_pseudo, ''), p_action, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Refuse si `p_target` est administrateur et qu'aucun AUTRE administrateur actif (non bloqué) ne resterait.
create or replace function public.admin_assert_other_admin_remains(p_target uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if exists (select 1 from public.profiles where id = p_target and is_admin)
     and not exists (
       select 1 from public.profiles p join auth.users u on u.id = p.id
       where p.is_admin and p.id <> p_target and not coalesce(u.banned_until > now(), false)
     ) then
    raise exception 'last_admin';
  end if;
end;
$$;

revoke all on function public.admin_audit(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_assert_other_admin_remains(uuid) from public, anon, authenticated;

-- Désactiver (`p_disabled` vrai) ou réactiver un compte.
create or replace function public.admin_set_user_disabled(p_user_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_pseudo text;
  is_banned boolean;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select p.pseudo, coalesce(u.banned_until > now(), false) into target_pseudo, is_banned
  from public.profiles p join auth.users u on u.id = p.id where p.id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  if p_disabled then
    if p_user_id = auth.uid() then raise exception 'self_forbidden'; end if;
    perform public.admin_assert_other_admin_remains(p_user_id);
    if is_banned then return; end if;
    update auth.users set banned_until = now() + interval '100 years', updated_at = now() where id = p_user_id;
    -- Plus de renouvellement possible : ses sessions et leurs jetons de rafraîchissement disparaissent.
    delete from auth.sessions where user_id = p_user_id;
    delete from auth.refresh_tokens where user_id = p_user_id::text;
    perform public.admin_audit('disable', p_user_id, target_pseudo);
  else
    if not is_banned then return; end if;
    update auth.users set banned_until = null, updated_at = now() where id = p_user_id;
    perform public.admin_audit('enable', p_user_id, target_pseudo);
  end if;
end;
$$;

-- Corriger le pseudo (modération) et l'avatar. Mêmes bornes que le formulaire de profil : pseudo de 1 à 30 caractères.
create or replace function public.admin_update_user_profile(p_user_id uuid, p_pseudo text, p_avatar text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  old_pseudo text;
  old_avatar text;
  new_pseudo text := btrim(coalesce(p_pseudo, ''));
  new_avatar text := btrim(coalesce(p_avatar, ''));
  changes jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select pseudo, avatar into old_pseudo, old_avatar from public.profiles where id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if char_length(new_pseudo) not between 1 and 30 then raise exception 'invalid_pseudo'; end if;
  if char_length(new_avatar) not between 1 and 16 then raise exception 'invalid_avatar'; end if;

  if new_pseudo <> old_pseudo then changes := changes || jsonb_build_object('pseudo', jsonb_build_object('from', old_pseudo, 'to', new_pseudo)); end if;
  if new_avatar <> old_avatar then changes := changes || jsonb_build_object('avatar', jsonb_build_object('from', old_avatar, 'to', new_avatar)); end if;
  if changes = '{}'::jsonb then return; end if;

  update public.profiles set pseudo = new_pseudo, avatar = new_avatar where id = p_user_id;
  perform public.admin_audit('update_profile', p_user_id, new_pseudo, changes);
end;
$$;

-- Nommer ou retirer un administrateur.
create or replace function public.admin_set_user_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_pseudo text;
  was_admin boolean;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select pseudo, is_admin into target_pseudo, was_admin from public.profiles where id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  if not p_is_admin then
    if p_user_id = auth.uid() then raise exception 'self_forbidden'; end if;
    perform public.admin_assert_other_admin_remains(p_user_id);
  end if;
  if was_admin = p_is_admin then return; end if;

  update public.profiles set is_admin = p_is_admin where id = p_user_id;
  perform public.admin_audit('set_admin', p_user_id, target_pseudo, jsonb_build_object('is_admin', p_is_admin));
end;
$$;

-- Accorder ou retirer l'accès d'un utilisateur à un quiz (un quiz public n'en a pas besoin).
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
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
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

-- Efface l'historique et la progression de révision d'un utilisateur dans Oliver Quiz (ni son compte, ni ses accès, ni ses
-- données dans les autres applications). Renvoie ce qui a été effacé.
create or replace function public.admin_reset_user_progress(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_pseudo text;
  n_classic int;
  n_questions int;
  n_streak int;
  n_timed int;
  n_progress int;
  deleted jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select pseudo into target_pseudo from public.profiles where id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  delete from public.quiz_results where user_id = p_user_id;
  get diagnostics n_classic = row_count;
  delete from public.question_results where user_id = p_user_id;
  get diagnostics n_questions = row_count;
  delete from public.streak_results where user_id = p_user_id;
  get diagnostics n_streak = row_count;
  delete from public.timed_results where user_id = p_user_id;
  get diagnostics n_timed = row_count;
  delete from public.question_progress where user_id = p_user_id;
  get diagnostics n_progress = row_count;

  deleted := jsonb_build_object('quiz_results', n_classic, 'question_results', n_questions, 'streak_results', n_streak, 'timed_results', n_timed, 'question_progress', n_progress);
  if n_classic + n_questions + n_streak + n_timed + n_progress > 0 then
    perform public.admin_audit('reset_progress', p_user_id, target_pseudo, deleted);
  end if;
  return deleted;
end;
$$;

-- Supprime définitivement un compte et ses données (même cascade que `delete_my_account()`, 036 : profil, parties, journal des
-- questions, progression, accès — et, le projet étant partagé, ses données dans Quiz Forge et Periodic Quiz). Les quiz et les
-- liens invités qu'il avait créés restent, sans auteur.
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

  perform public.admin_audit('delete_user', p_user_id, target_pseudo);
  update public.quizzes set created_by = null where created_by = p_user_id;
  update public.guest_links set created_by = null where created_by = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_user_disabled(uuid, boolean) from public, anon;
revoke all on function public.admin_update_user_profile(uuid, text, text) from public, anon;
revoke all on function public.admin_set_user_admin(uuid, boolean) from public, anon;
revoke all on function public.admin_set_user_quiz_access(uuid, uuid, boolean) from public, anon;
revoke all on function public.admin_reset_user_progress(uuid) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
grant execute on function public.admin_update_user_profile(uuid, text, text) to authenticated;
grant execute on function public.admin_set_user_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_set_user_quiz_access(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_reset_user_progress(uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- La liste et la fiche (047) indiquent aussi quel utilisateur est l'appelant (`is_self`) : l'interface cache alors les actions
-- que les garde-fous refuseraient de toute façon. Seule différence avec 047 : cette clé en plus.
create or replace function public.admin_list_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.id,
      'pseudo', p.pseudo,
      'avatar', p.avatar,
      'email', u.email,
      'is_admin', p.is_admin,
      'is_self', p.id = auth.uid(),
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'disabled', coalesce(u.banned_until > now(), false),
      'games_played', g.games,
      'last_played_at', g.last_played
    ) order by lower(p.pseudo), p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    cross join lateral (
      select count(*)::int as games, max(x.created_at) as last_played
      from (
        select created_at from public.quiz_results where user_id = p.id
        union all
        select created_at from public.streak_results where user_id = p.id
        union all
        select created_at from public.timed_results where user_id = p.id and question_count > 0
      ) x
    ) g
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'user_id', p.id,
    'pseudo', p.pseudo,
    'avatar', p.avatar,
    'email', u.email,
    'is_admin', p.is_admin,
    'is_self', p.id = auth.uid(),
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'disabled', coalesce(u.banned_until > now(), false),
    'games_played', g.classic + g.streak + g.timed,
    'last_played_at', g.last_played,
    'games', jsonb_build_object('classic', g.classic, 'streak', g.streak, 'timed', g.timed),
    'quizzes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'quiz_id', q.id,
        'quiz_title', q.title,
        'question_count', coalesce(jsonb_array_length(q.content -> 'questions'), 0),
        'seen_count', (
          select count(distinct e.value ->> 'id')
          from jsonb_array_elements(coalesce(q.content -> 'questions', '[]'::jsonb)) as e (value)
          where exists (select 1 from public.question_results r where r.user_id = p.id and r.quiz_id = q.id and r.question_id = e.value ->> 'id')
             or exists (select 1 from public.question_progress pr where pr.user_id = p.id and pr.quiz_id = q.id and pr.question_id = e.value ->> 'id')
        ),
        'games_played', qg.games,
        'last_played_at', qg.last_played,
        'has_access', exists (select 1 from public.quiz_access qa where qa.quiz_id = q.id and qa.user_id = p.id),
        'is_public', q.is_public
      ) order by lower(q.title)), '[]'::jsonb)
      from public.quizzes q
      cross join lateral (
        select count(*)::int as games, max(x.created_at) as last_played
        from (
          select created_at from public.quiz_results where user_id = p.id and quiz_id = q.id
          union all
          select created_at from public.streak_results where user_id = p.id and quiz_id = q.id
          union all
          select created_at from public.timed_results where user_id = p.id and quiz_id = q.id and question_count > 0
        ) x
      ) qg
    )
  ) into result
  from public.profiles p
  join auth.users u on u.id = p.id
  cross join lateral (
    select
      (select count(*)::int from public.quiz_results where user_id = p.id) as classic,
      (select count(*)::int from public.streak_results where user_id = p.id) as streak,
      (select count(*)::int from public.timed_results where user_id = p.id and question_count > 0) as timed,
      (select max(x.created_at) from (
        select created_at from public.quiz_results where user_id = p.id
        union all
        select created_at from public.streak_results where user_id = p.id
        union all
        select created_at from public.timed_results where user_id = p.id and question_count > 0
      ) x) as last_played
  ) g
  where p.id = p_user_id;

  if result is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;
