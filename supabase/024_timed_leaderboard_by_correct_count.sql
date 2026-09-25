-- Le classement contre-la-montre ne gardait qu'une ligne par joueur/quiz (DISTINCT ON), choisie par le
-- meilleur rythme (correct/elapsed) seul : une partie de quelques secondes avec 2/2 bonnes réponses battait
-- ainsi une vraie partie de 20 minutes bien plus remplie, exactement le même défaut "taux avant volume" déjà
-- corrigé pour le classement classique (023_leaderboard_by_correct_count.sql). Le nombre de bonnes réponses
-- prime désormais, le rythme ne départage plus qu'à égalité.
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
  tr.quiz_id
from public.timed_results tr
join public.profiles p on p.id = tr.user_id
left join public.quizzes qz on qz.id = tr.quiz_id
where tr.unfiltered
order by coalesce(tr.quiz_id::text, tr.quiz_title), tr.user_id,
  tr.correct_count desc,
  (tr.correct_count::numeric / nullif(tr.elapsed_seconds, 0)) desc nulls last;

grant select on public.timed_leaderboard to authenticated;
