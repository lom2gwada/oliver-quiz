-- Page « Utilisateurs » de l'administration (#229) : liste et fiche d'un utilisateur, en lecture seule.
--
-- L'email, la dernière connexion et le blocage d'un compte vivent dans `auth.users`, que le client ne peut pas lire. Ces deux
-- fonctions `security definer` (même approche que `delete_my_account()`, 036) les exposent, mais UNIQUEMENT à un administrateur :
-- chacune commence par `is_admin()` (qui lit `auth.uid()`, toujours celui de l'appelant même sous `security definer`) et refuse
-- sinon. Aucun droit pour `anon` ni `public`.
--
-- Chaque fonction renvoie UN document jsonb plutôt qu'une ligne par élément : PostgREST plafonne le nombre de lignes d'une
-- réponse (1000 par défaut), et un document n'a pas cette limite.
--
-- « Parties » = classique + sans-faute + contre-la-montre, hors contre-la-montre sans aucune question tentée (comme
-- `my_quiz_coverage()`, 034). Une question est « vue » comme dans `my_quiz_coverage()` (028) : présente dans `question_results`
-- ou `question_progress`, et encore présente dans le quiz. Pas de réponses question par question : seulement des totaux.
-- `disabled` : le compte est bloqué (`banned_until` dans le futur) — rien ne le renseigne encore, c'est le ticket des actions.

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

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
