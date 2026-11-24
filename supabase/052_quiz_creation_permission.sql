-- Création de quiz par d'autres comptes que l'administrateur global (#243).
--
-- Un compte peut créer des quiz s'il en a reçu l'AUTORISATION (`profiles.can_create_quizzes`, désactivée par défaut), que seul
-- l'administrateur global accorde ou retire (`admin_set_user_can_create_quizzes`, inscrite au journal d'audit). Le créateur d'un
-- quiz en devient propriétaire (déclencheur de 051). Retirer l'autorisation ne retire aucun quiz déjà créé : ses quiz restent les siens.
--
-- Contrôlé EN BASE, dans `upsert_quiz` (la seule porte de création, 051) :
--   * l'administrateur global ou un compte autorisé ET non désactivé (`can_create_quiz()`) — un compte désactivé garde un jeton valide
--     jusqu'à 1 h, d'où le contrôle de `auth.users.banned_until` ;
--   * plafonds pour les comptes autorisés (l'administrateur global en est exempté), dans `quiz_creator_limits()` : 10 quiz créés au plus
--     par compte, et 3 Mo de JSON au plus par quiz (le plus gros quiz actuel fait 1,8 Mo, 1 878 questions). Changer ces valeurs : une
--     migration qui remplace cette fonction. Le plafond de taille vaut pour toute écriture d'un administrateur de quiz qui n'est pas
--     administrateur global (`update_quiz` aussi), sinon un quiz créé petit pourrait grossir sans limite ;
--   * un verrou par compte pour que deux créations simultanées ne dépassent pas le plafond.
--
-- Titres : `quizzes.title` reste unique pour tous les quiz (l'historique ancien, les classements et les listes s'y réfèrent encore ;
-- deux « Culture générale » de créateurs différents se confondraient). Conséquence connue : quelqu'un qui peut créer apprend, par
-- `title_unavailable`, qu'un quiz de ce titre existe — jamais à qui il appartient, ni son contenu. Un compte qui n'a PAS le droit de créer
-- reçoit toujours `forbidden`, qu'un quiz porte ce titre ou non : rien ne fuit pour lui.
--
-- Le journal d'audit reçoit l'action `set_can_create_quizzes` ; la liste et la fiche d'un utilisateur disent s'il est autorisé.

alter table public.profiles add column can_create_quizzes boolean not null default false;

-- Un joueur lit sa propre autorisation (de quoi afficher la création) mais ne peut pas l'écrire : 046 n'accorde l'écriture qu'aux
-- colonnes listées, et celle-ci ne l'est pas.
grant select (can_create_quizzes) on public.profiles to authenticated;

alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action in (
  'disable', 'enable', 'update_profile', 'set_admin', 'reset_progress', 'delete_user', 'grant_access', 'revoke_access',
  'invite_user', 'resend_invite', 'send_password_reset', 'change_email',
  'export_user_data',
  'set_can_create_quizzes'
));

create or replace function public.quiz_creator_limits() returns jsonb
  language sql immutable
as $$
  select jsonb_build_object('max_quizzes', 10, 'max_bytes', 3000000)
$$;

-- Le compte connecté peut-il créer un quiz ? Administrateur global, ou compte autorisé et non désactivé.
create or replace function public.can_create_quiz() returns boolean
  language sql security definer stable
  set search_path = public, auth
as $$
  select coalesce((
    select p.is_admin or (p.can_create_quizzes and not coalesce(u.banned_until > now(), false))
    from public.profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid()
  ), false)
$$;

-- Refuse un contenu trop gros (`quiz_too_large`) pour qui n'est pas administrateur global.
create or replace function public.quiz_assert_size(p_content jsonb) returns void
  language plpgsql
  set search_path = public
as $$
begin
  if not public.is_admin() and octet_length(p_content::text) > (public.quiz_creator_limits() ->> 'max_bytes')::int then
    raise exception 'quiz_too_large';
  end if;
end;
$$;

revoke all on function public.quiz_creator_limits() from public, anon;
revoke all on function public.can_create_quiz() from public, anon;
revoke all on function public.quiz_assert_size(jsonb) from public, anon, authenticated;
grant execute on function public.quiz_creator_limits() to authenticated;
grant execute on function public.can_create_quiz() to authenticated;

-- Crée le quiz s'il n'existe pas (compte autorisé : `title_unavailable` si le titre est pris), sinon remplace son contenu par titre
-- (import d'un fichier) : administrateurs du quiz. N'accorde jamais d'accès. Renvoie l'id.
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
  return new_id;
end;
$$;

-- Modifie un quiz existant par id (051), avec le plafond de taille pour qui n'est pas administrateur global.
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
  perform public.quiz_assert_size(p_content);
  update public.quizzes set title = p_title, content = p_content, updated_at = new_version where id = p_id;
  return new_version;
end;
$$;

-- Accorde (`p_allowed` vrai) ou retire l'autorisation de créer des quiz : administrateur global seulement. Sans effet si elle est déjà
-- dans cet état. Retirer l'autorisation ne touche pas aux quiz déjà créés.
create or replace function public.admin_set_user_can_create_quizzes(p_user_id uuid, p_allowed boolean) returns void
  language plpgsql security definer
  set search_path = public, auth
as $$
declare
  target_pseudo text;
  was_allowed boolean;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select pseudo, can_create_quizzes into target_pseudo, was_allowed from public.profiles where id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if was_allowed = p_allowed then return; end if;

  update public.profiles set can_create_quizzes = p_allowed where id = p_user_id;
  perform public.admin_audit('set_can_create_quizzes', p_user_id, target_pseudo, jsonb_build_object('allowed', p_allowed));
end;
$$;

revoke all on function public.admin_set_user_can_create_quizzes(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_can_create_quizzes(uuid, boolean) to authenticated;
revoke all on function public.upsert_quiz(text, jsonb) from public, anon;
revoke all on function public.update_quiz(uuid, text, jsonb, timestamptz) from public, anon;

-- La liste et la fiche d'un utilisateur (048) disent s'il est autorisé à créer des quiz. Seule différence avec 048 : cette clé en plus.
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
      'can_create_quizzes', p.can_create_quizzes,
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
    'can_create_quizzes', p.can_create_quizzes,
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
