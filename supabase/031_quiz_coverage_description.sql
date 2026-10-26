-- Ajoute `description` et `language` à `my_quiz_coverage()` (029) : la section « À découvrir » de « Mes quiz » présente
-- les quiz jamais joués, et un titre seul ne dit pas de quoi ils parlent. Les deux viennent de `content.metadata`
-- (`null` quand le quiz n'en précise pas) ; seules ces deux colonnes sont ajoutées, à la fin.
-- Le type de retour change : `create or replace` ne suffit pas, il faut recréer la fonction.
drop function if exists public.my_quiz_coverage();

create function public.my_quiz_coverage()
returns table (
  quiz_id uuid,
  quiz_title text,
  question_count int,
  seen_count int,
  games_played int,
  last_played_at timestamptz,
  due_count int,
  description text,
  language text
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
    (select max(g.created_at) from games g where g.quiz_id = q.id),
    (select count(*) from public.question_progress p
       join current_questions cq on cq.quiz_id = p.quiz_id and cq.question_id = p.question_id
      where p.user_id = auth.uid() and p.quiz_id = q.id and p.due_at <= now())::int,
    nullif(btrim(q.content -> 'metadata' ->> 'description'), ''),
    nullif(btrim(q.content -> 'metadata' ->> 'language'), '')
  from public.quizzes q
  order by q.title;
$$;

grant execute on function public.my_quiz_coverage() to authenticated;
