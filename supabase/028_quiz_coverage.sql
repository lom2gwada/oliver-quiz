-- Vue d'ensemble « mes quiz » : pour chaque quiz auquel l'utilisateur a accès, combien de questions il a déjà
-- rencontrées sur le total actuel du quiz, et combien de parties il y a jouées (tous modes confondus).
--
-- `security invoker` : la RLS de `quizzes` (accès accordé / quiz public / admin) filtre naturellement la liste.
-- « Rencontrée » = présente dans `question_results` (journal de chaque partie classique) ou `question_progress`
-- (Leitner). Les modes sans-faute et contre-la-montre n'enregistrent pas le détail question par question
-- (seulement des agrégats), ils ne comptent donc que dans `games_played`/`last_played_at`. Seuls les ids
-- encore présents dans `quizzes.content` sont comptés : une question supprimée depuis par un admin ne doit pas
-- faire dépasser 100 %.
create or replace function public.my_quiz_coverage()
returns table (
  quiz_id uuid,
  quiz_title text,
  question_count int,
  seen_count int,
  games_played int,
  last_played_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with current_questions as (
    select q.id as quiz_id, q.title, e.value ->> 'id' as question_id
    from public.quizzes q
    cross join lateral jsonb_array_elements(q.content -> 'questions') as e (value)
  ),
  seen as (
    select r.quiz_id, r.question_id from public.question_results r where r.user_id = auth.uid() and r.quiz_id is not null
    union
    select p.quiz_id, p.question_id from public.question_progress p where p.user_id = auth.uid()
  ),
  games as (
    select g.quiz_id, g.created_at from public.quiz_results g where g.user_id = auth.uid() and g.quiz_id is not null
    union all
    select g.quiz_id, g.created_at from public.streak_results g where g.user_id = auth.uid() and g.quiz_id is not null
    union all
    select g.quiz_id, g.created_at from public.timed_results g where g.user_id = auth.uid() and g.quiz_id is not null
  )
  select
    q.id,
    q.title,
    coalesce(jsonb_array_length(q.content -> 'questions'), 0)::int,
    (select count(distinct cq.question_id) from current_questions cq
       join seen s on s.quiz_id = cq.quiz_id and s.question_id = cq.question_id
      where cq.quiz_id = q.id)::int,
    (select count(*) from games g where g.quiz_id = q.id)::int,
    (select max(g.created_at) from games g where g.quiz_id = q.id)
  from public.quizzes q
  order by q.title;
$$;

grant execute on function public.my_quiz_coverage() to authenticated;
