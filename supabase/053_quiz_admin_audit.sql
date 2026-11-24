-- Journal d'audit de l'administration par quiz (#244).
--
-- Le journal (`admin_audit_log`, 048 à 052) garde désormais aussi les actions de GESTION d'un quiz — pas chaque modification de question :
--   * `create_quiz`          : un quiz est créé (administrateur global ou compte autorisé) ;
--   * `delete_quiz`          : un quiz est supprimé (avec ou sans effacement de l'historique des parties) ;
--   * `set_quiz_public`      : un quiz est rendu public ou privé ;
--   * `add_quiz_admin`       : un compte devient administrateur ou propriétaire d'un quiz ;
--   * `remove_quiz_admin`    : un compte cesse de l'être (retiré, ou parti de lui-même) ;
--   * `promote_quiz_admin`   : administrateur → propriétaire ;
--   * `demote_quiz_admin`    : propriétaire → administrateur ;
--   * `grant_access` / `revoke_access` (048) : existaient déjà, pour l'accès d'un joueur à un quiz.
-- Plus `set_can_create_quizzes` (052), déjà au journal.
--
-- Chaque ligne est écrite PAR LA FONCTION qui fait l'action (jamais par l'interface) : impossible de l'oublier, ou de l'écrire sans
-- que l'action ait eu lieu. Une action sans effet (rôle déjà le bon, quiz déjà public…) ne laisse aucune ligne.
--
-- Le quiz concerné est désigné par `details.quiz_id` et `details.quiz_title` : le TITRE AU MOMENT DE L'ACTION, car le titre peut
-- changer, et le quiz peut être supprimé. Un champ `quiz_id` (colonne générée, donc toujours d'accord avec les détails) permet de
-- retrouver toutes les lignes d'un quiz, y compris celles d'un quiz supprimé depuis. Les lignes des 048 (accès accordé ou retiré) en
-- profitent d'office : elles portaient déjà ces deux détails.
--
-- `target_id` devient facultatif : une action sur le quiz lui-même (créé, supprimé, rendu public) ne vise aucun compte.
--
-- Qui lit :
--   * l'administrateur global, tout (comme avant, par la table) ;
--   * le propriétaire d'un quiz, les lignes de CE quiz, par `quiz_audit_log(quiz_id)` ; pas un simple administrateur du quiz.
-- Le journal ne contient que des pseudos, jamais d'email : le propriétaire n'en apprend aucun.
--
-- `created_by` d'un quiz reste l'AUTEUR D'ORIGINE (il passe à `null` si son compte est supprimé) ; la propriété, elle, est dans
-- `quiz_admins`. On peut donc être propriétaire sans être l'auteur, et l'auteur peut ne plus être propriétaire. Le plafond de 10 quiz
-- (052) compte les quiz DONT ON EST L'AUTEUR, pas ceux dont on est propriétaire.

-- ============================================================================================================
-- Schéma
-- ============================================================================================================

alter table public.admin_audit_log alter column target_id drop not null;

alter table public.admin_audit_log add column if not exists quiz_id uuid
  generated always as (nullif(details ->> 'quiz_id', '')::uuid) stored;

create index if not exists admin_audit_log_quiz_idx on public.admin_audit_log (quiz_id, created_at desc) where quiz_id is not null;

alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action in (
  'disable', 'enable', 'update_profile', 'set_admin', 'reset_progress', 'delete_user', 'grant_access', 'revoke_access',
  'invite_user', 'resend_invite', 'send_password_reset', 'change_email',
  'export_user_data',
  'set_can_create_quizzes',
  'create_quiz', 'delete_quiz', 'set_quiz_public',
  'add_quiz_admin', 'remove_quiz_admin', 'promote_quiz_admin', 'demote_quiz_admin'
));

-- Le déclencheur « le créateur devient propriétaire » (051) n'a pas à être appelable : un trigger s'exécute sans que son déclencheur
-- ait besoin du droit d'exécution de la fonction.
revoke all on function public.quizzes_add_creator_as_owner() from public, anon, authenticated;

-- ============================================================================================================
-- Création, visibilité, suppression d'un quiz
-- ============================================================================================================

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
    if public.is_quiz_admin(existing) then
      perform public.quiz_assert_size(p_content);
      update public.quizzes set content = p_content, updated_at = clock_timestamp() where id = existing;
      return existing;
    end if;
    if public.can_create_quiz() then raise exception 'title_unavailable'; end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not public.can_create_quiz() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.is_admin() then
    perform pg_advisory_xact_lock(hashtext('quiz_create:' || auth.uid()::text));
    if (select count(*) from public.quizzes where created_by = auth.uid()) >= (public.quiz_creator_limits() ->> 'max_quizzes')::int then
      raise exception 'quiz_limit_reached';
    end if;
    perform public.quiz_assert_size(p_content);
  end if;
  insert into public.quizzes (title, content, created_by) values (p_title, p_content, auth.uid()) returning id into new_id;
  perform public.admin_audit('create_quiz', null, '', jsonb_build_object('quiz_id', new_id, 'quiz_title', p_title));
  return new_id;
end;
$$;

create or replace function public.set_quiz_public(p_quiz_id uuid, p_is_public boolean) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_title text;
  was_public boolean;
begin
  if not public.is_quiz_owner(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select title, is_public into v_title, was_public from public.quizzes where id = p_quiz_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if was_public = p_is_public then return; end if;
  update public.quizzes set is_public = p_is_public where id = p_quiz_id;
  perform public.admin_audit('set_quiz_public', null, '', jsonb_build_object('quiz_id', p_quiz_id, 'quiz_title', v_title, 'is_public', p_is_public));
end;
$$;

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
  perform public.admin_audit('delete_quiz', null, '', jsonb_build_object(
    'quiz_id', p_quiz_id, 'quiz_title', v_title, 'purge_history', p_purge_history,
    'quiz_results', n_classic, 'question_results', n_questions, 'streak_results', n_streak, 'timed_results', n_timed));
  delete from public.quizzes where id = p_quiz_id;
  return jsonb_build_object('quiz_results', n_classic, 'question_results', n_questions, 'streak_results', n_streak, 'timed_results', n_timed);
end;
$$;

-- ============================================================================================================
-- Administrateurs d'un quiz
-- ============================================================================================================

create or replace function public.quiz_set_admin_role(p_quiz_id uuid, p_user_id uuid, p_role text) returns void
  language plpgsql security definer
  set search_path = public, auth
as $$
declare
  is_banned boolean;
  member_role text;
  v_title text;
  target_pseudo text;
begin
  if not public.is_quiz_owner(p_quiz_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('owner', 'admin') then raise exception 'invalid_role'; end if;
  -- Verrou sur le quiz : deux propriétaires qui se rétrogradent l'un l'autre en même temps passent l'un après l'autre.
  select title into v_title from public.quizzes where id = p_quiz_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select coalesce(u.banned_until > now(), false), p.pseudo into is_banned, target_pseudo
  from public.profiles p join auth.users u on u.id = p.id where p.id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  select role into member_role from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_user_id;
  if member_role is null and is_banned then raise exception 'user_disabled'; end if;
  if member_role = p_role then return; end if;
  if member_role = 'owner' and p_role = 'admin' then perform public.quiz_assert_other_owner_remains(p_quiz_id, p_user_id); end if;

  insert into public.quiz_admins (quiz_id, user_id, role, added_by) values (p_quiz_id, p_user_id, p_role, auth.uid())
  on conflict (quiz_id, user_id) do update set role = excluded.role;

  perform public.admin_audit(
    case when member_role is null then 'add_quiz_admin' when p_role = 'owner' then 'promote_quiz_admin' else 'demote_quiz_admin' end,
    p_user_id, target_pseudo,
    jsonb_build_object('quiz_id', p_quiz_id, 'quiz_title', v_title, 'role', p_role));
end;
$$;

create or replace function public.quiz_remove_admin(p_quiz_id uuid, p_user_id uuid) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  member_role text;
  v_title text;
  target_pseudo text;
begin
  if not (
    public.is_quiz_owner(p_quiz_id)
    or (p_user_id = auth.uid() and exists (select 1 from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_user_id))
  ) then raise exception 'forbidden' using errcode = '42501'; end if;
  select title into v_title from public.quizzes where id = p_quiz_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  select role into member_role from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_user_id;
  if member_role is null then return; end if;
  if member_role = 'owner' then perform public.quiz_assert_other_owner_remains(p_quiz_id, p_user_id); end if;
  delete from public.quiz_admins where quiz_id = p_quiz_id and user_id = p_user_id;

  select pseudo into target_pseudo from public.profiles where id = p_user_id;
  perform public.admin_audit('remove_quiz_admin', p_user_id, target_pseudo,
    jsonb_build_object('quiz_id', p_quiz_id, 'quiz_title', v_title, 'role', member_role, 'self', p_user_id = auth.uid()));
end;
$$;

-- ============================================================================================================
-- Lecture du journal d'un quiz
-- ============================================================================================================

-- Les dernières lignes du journal qui concernent un quiz (le plus récent d'abord) : son propriétaire, ou l'administrateur global.
-- Sans quiz (`p_quiz_id` nul) : toute l'activité sur les quiz, y compris celle des quiz supprimés et les autorisations de création,
-- réservée à l'administrateur global. Des pseudos seulement, jamais d'email.
create or replace function public.quiz_audit_log(p_quiz_id uuid default null, p_limit int default 100) returns jsonb
  language plpgsql stable security definer
  set search_path = public
as $$
declare
  n int := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if p_quiz_id is null then
    if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not public.is_quiz_owner(p_quiz_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'created_at', l.created_at, 'admin_pseudo', l.admin_pseudo, 'target_pseudo', l.target_pseudo,
      'action', l.action, 'details', l.details
    ) order by l.created_at desc, l.id)
    from (
      select * from public.admin_audit_log
      where case when p_quiz_id is null then quiz_id is not null or action = 'set_can_create_quizzes' else quiz_id = p_quiz_id end
      order by created_at desc, id
      limit n
    ) l
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.quiz_audit_log(uuid, int) from public, anon;
grant execute on function public.quiz_audit_log(uuid, int) to authenticated;
revoke all on function public.upsert_quiz(text, jsonb) from public, anon;
revoke all on function public.set_quiz_public(uuid, boolean) from public, anon;
revoke all on function public.delete_quiz(uuid, boolean) from public, anon;
revoke all on function public.quiz_set_admin_role(uuid, uuid, text) from public, anon;
revoke all on function public.quiz_remove_admin(uuid, uuid) from public, anon;
grant execute on function public.upsert_quiz(text, jsonb) to authenticated;
grant execute on function public.set_quiz_public(uuid, boolean) to authenticated;
grant execute on function public.delete_quiz(uuid, boolean) to authenticated;
grant execute on function public.quiz_set_admin_role(uuid, uuid, text) to authenticated;
grant execute on function public.quiz_remove_admin(uuid, uuid) to authenticated;
