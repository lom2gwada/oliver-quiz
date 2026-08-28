-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Remplace la vue `leaderboard` (005_add_leaderboard_view.sql) : à score égal, on
-- départage par earned_points (favorise les questions plus nombreuses/difficiles, puisque
-- chaque question vaut plus de points selon sa difficulté) puis par elapsed_seconds (le plus
-- rapide gagne). `DISTINCT ON (quiz_title, user_id)` + cet ORDER BY donne exactement la
-- meilleure partie de chaque utilisateur selon ces trois critères, dans cet ordre de
-- priorité. Toujours une SECURITY DEFINER VIEW, voir 005 pour l'explication.

create or replace view public.leaderboard as
select distinct on (qr.quiz_title, qr.user_id)
  qr.quiz_title,
  qr.user_id,
  p.pseudo,
  p.avatar,
  qr.score as best_score,
  qr.earned_points,
  qr.total_points,
  qr.elapsed_seconds
from public.quiz_results qr
join public.profiles p on p.id = qr.user_id
order by qr.quiz_title, qr.user_id, qr.score desc, qr.earned_points desc, qr.elapsed_seconds asc;

grant select on public.leaderboard to authenticated;
