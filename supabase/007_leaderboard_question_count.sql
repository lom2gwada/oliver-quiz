-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Ajoute `question_count` à la vue `leaderboard` (006_leaderboard_tiebreak.sql), pour
-- afficher le détail (nb de questions, points, temps) sur la page de classement.

create or replace view public.leaderboard as
select distinct on (qr.quiz_title, qr.user_id)
  qr.quiz_title,
  qr.user_id,
  p.pseudo,
  p.avatar,
  qr.score as best_score,
  qr.earned_points,
  qr.total_points,
  qr.elapsed_seconds,
  qr.question_count
from public.quiz_results qr
join public.profiles p on p.id = qr.user_id
order by qr.quiz_title, qr.user_id, qr.score desc, qr.earned_points desc, qr.elapsed_seconds asc;

grant select on public.leaderboard to authenticated;
