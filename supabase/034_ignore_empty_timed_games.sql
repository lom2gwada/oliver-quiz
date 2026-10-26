-- Une partie contre-la-montre sans aucune question tentée (« 0 / 0 ») ne dit rien (#166). Le client ne les enregistre plus ;
-- celles déjà enregistrées sont écartées ici, sans rien supprimer : du décompte « parties » de `my_quiz_coverage()` (Mes quiz),
-- du classement contre-la-montre et du classement Général. Mêmes colonnes qu'avant (031/032 et 027), seules les conditions changent.

create or replace function public.my_quiz_coverage()
returns table (
  quiz_id uuid,
  quiz_title text,
  question_count int,
  seen_count int,
  games_played int,
  last_played_at timestamptz,
  due_count int,
  description text,
  language text,
  image_url text,
  image_alt text
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
    select g.quiz_id, g.created_at from public.timed_results g where g.user_id = auth.uid() and g.quiz_id is not null and g.question_count > 0
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
    nullif(btrim(q.content -> 'metadata' ->> 'language'), ''),
    nullif(btrim(q.content -> 'metadata' -> 'image' ->> 'url'), ''),
    nullif(btrim(q.content -> 'metadata' -> 'image' ->> 'alt'), '')
  from public.quizzes q
  order by q.title;
$$;

grant execute on function public.my_quiz_coverage() to authenticated;

create or replace view public.timed_leaderboard as
select distinct on (coalesce(tr.quiz_id::text, tr.quiz_title), tr.user_id)
  coalesce(qz.title, tr.quiz_title) as quiz_title,
  tr.user_id,
  p.pseudo,
  p.avatar,
  tr.correct_count,
  tr.question_count,
  tr.duration_seconds,
  tr.elapsed_seconds,
  round((tr.correct_count::numeric / nullif(tr.elapsed_seconds, 0)) * 60, 1) as pace_per_minute,
  tr.themes,
  tr.quiz_id,
  tr.earned_points,
  tr.total_points,
  tr.created_at as played_at
from public.timed_results tr
join public.profiles p on p.id = tr.user_id
left join public.quizzes qz on qz.id = tr.quiz_id
where tr.unfiltered and tr.question_count > 0
order by coalesce(tr.quiz_id::text, tr.quiz_title), tr.user_id,
  tr.correct_count desc,
  (tr.correct_count::numeric / nullif(tr.elapsed_seconds, 0)) desc nulls last;

grant select on public.timed_leaderboard to authenticated;

create or replace view public.overall_leaderboard as
select
  coalesce(max(qz.title), max(combined.quiz_title)) as quiz_title,
  combined.user_id,
  p.pseudo,
  p.avatar,
  sum(combined.correct_count) as total_correct,
  sum(combined.attempted_count) as total_attempted,
  round(sum(combined.correct_count)::numeric / nullif(sum(combined.attempted_count), 0) * 100, 1) as success_rate,
  count(*) as games_played,
  combined.quiz_id,
  sum(coalesce(combined.earned_points, 0)) as total_earned_points,
  max(combined.created_at) as last_played_at
from (
  select quiz_id, quiz_title, user_id, correct_count, question_count as attempted_count, earned_points, created_at
  from public.quiz_results
  where unfiltered
  union all
  select quiz_id, quiz_title, user_id, streak_count as correct_count,
    streak_count + case when victory then 0 else 1 end as attempted_count, earned_points, created_at
  from public.streak_results
  where unfiltered
  union all
  select quiz_id, quiz_title, user_id, correct_count, question_count as attempted_count, earned_points, created_at
  from public.timed_results
  where unfiltered and question_count > 0
) combined
join public.profiles p on p.id = combined.user_id
left join public.quizzes qz on qz.id = combined.quiz_id
group by combined.quiz_id, coalesce(combined.quiz_id::text, combined.quiz_title), combined.user_id, p.pseudo, p.avatar;

grant select on public.overall_leaderboard to authenticated;
