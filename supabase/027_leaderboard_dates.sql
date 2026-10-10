-- Date affichée dans les classements : celle de la partie retenue pour chaque joueur (sa meilleure partie dans
-- les trois modes), et celle de sa dernière partie pour le classement "Général", qui cumule toutes les parties.
-- Colonnes ajoutées en toute fin de chaque vue (`create or replace view` ne permet ni de réordonner ni de
-- retirer les colonnes existantes).
create or replace view public.leaderboard as
select distinct on (coalesce(qr.quiz_id::text, qr.quiz_title), qr.user_id)
  coalesce(qz.title, qr.quiz_title) as quiz_title,
  qr.user_id,
  p.pseudo,
  p.avatar,
  qr.score as best_score,
  qr.earned_points,
  qr.total_points,
  qr.elapsed_seconds,
  qr.question_count,
  qr.quiz_id,
  qr.correct_count,
  round((qr.correct_count::numeric / nullif(qr.elapsed_seconds, 0)) * 60, 1) as pace_per_minute,
  qr.created_at as played_at
from public.quiz_results qr
join public.profiles p on p.id = qr.user_id
left join public.quizzes qz on qz.id = qr.quiz_id
where qr.unfiltered
order by coalesce(qr.quiz_id::text, qr.quiz_title), qr.user_id, qr.correct_count desc, qr.score desc, qr.earned_points desc, qr.elapsed_seconds asc;

grant select on public.leaderboard to authenticated;

create or replace view public.streak_leaderboard as
select distinct on (coalesce(sr.quiz_id::text, sr.quiz_title), sr.user_id)
  coalesce(qz.title, sr.quiz_title) as quiz_title,
  sr.user_id,
  p.pseudo,
  p.avatar,
  sr.streak_count as best_streak,
  sr.victory,
  sr.elapsed_seconds,
  sr.themes,
  sr.quiz_id,
  round((sr.streak_count::numeric / nullif(sr.elapsed_seconds, 0)) * 60, 1) as pace_per_minute,
  sr.earned_points,
  sr.total_points,
  sr.created_at as played_at
from public.streak_results sr
join public.profiles p on p.id = sr.user_id
left join public.quizzes qz on qz.id = sr.quiz_id
where sr.unfiltered
order by coalesce(sr.quiz_id::text, sr.quiz_title), sr.user_id, sr.streak_count desc, sr.victory desc, sr.elapsed_seconds asc;

grant select on public.streak_leaderboard to authenticated;

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
where tr.unfiltered
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
  where unfiltered
) combined
join public.profiles p on p.id = combined.user_id
left join public.quizzes qz on qz.id = combined.quiz_id
group by combined.quiz_id, coalesce(combined.quiz_id::text, combined.quiz_title), combined.user_id, p.pseudo, p.avatar;

grant select on public.overall_leaderboard to authenticated;
