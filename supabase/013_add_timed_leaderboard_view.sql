-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Classement du mode "contre-la-montre" : même schéma que `leaderboard`, mais sur
-- `timed_results`. Classé par rythme (bonnes réponses par minute) plutôt que par nombre brut
-- de bonnes réponses, pour rendre comparables des parties jouées avec des durées différentes
-- (5 min, 20 min, Infini) — un nombre brut aurait mécaniquement favorisé les parties longues.
-- Toujours une SECURITY DEFINER VIEW, voir 005_add_leaderboard_view.sql pour l'explication.

create view public.timed_leaderboard as
select distinct on (tr.quiz_title, tr.user_id)
  tr.quiz_title,
  tr.user_id,
  p.pseudo,
  p.avatar,
  tr.correct_count,
  tr.question_count,
  tr.duration_seconds,
  tr.elapsed_seconds,
  round((tr.correct_count::numeric / nullif(tr.elapsed_seconds, 0)) * 60, 1) as pace_per_minute,
  tr.themes
from public.timed_results tr
join public.profiles p on p.id = tr.user_id
order by tr.quiz_title, tr.user_id,
  (tr.correct_count::numeric / nullif(tr.elapsed_seconds, 0)) desc nulls last,
  tr.correct_count desc;

grant select on public.timed_leaderboard to authenticated;
