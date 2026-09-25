-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Le classement classique triait par pourcentage (`score`), ce qui avantage une partie courte parfaite
-- face à une partie plus longue avec un peu plus d'erreurs mais globalement plus de bonnes réponses.
-- À la demande de l'utilisateur, le nombre de bonnes réponses (`correct_count`, déjà présent sur
-- `quiz_results` depuis 015_add_overall_leaderboard_view.sql pour le classement "Général") devient le
-- critère dominant — même philosophie que ce classement "Général" existant, appliquée ici au classement
-- par quiz. Le pourcentage, puis le temps, ne servent plus qu'à départager une égalité.

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
  qr.correct_count
from public.quiz_results qr
join public.profiles p on p.id = qr.user_id
left join public.quizzes qz on qz.id = qr.quiz_id
where qr.unfiltered
order by coalesce(qr.quiz_id::text, qr.quiz_title), qr.user_id, qr.correct_count desc, qr.score desc, qr.earned_points desc, qr.elapsed_seconds asc;

grant select on public.leaderboard to authenticated;
