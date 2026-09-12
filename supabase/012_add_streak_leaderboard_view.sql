-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Classement du mode "sans-faute" : même schéma que `leaderboard` (005/006/007), mais sur
-- `streak_results`. Classé par streak_count desc ; à égalité, une victoire (pool filtré vidé
-- sans faute) passe devant, puis le plus rapide gagne. Comme le classement classique, le
-- filtre thème/difficulté choisi par le joueur n'est pas neutralisé (même logique acceptée).
-- Toujours une SECURITY DEFINER VIEW, voir 005_add_leaderboard_view.sql pour l'explication.

create view public.streak_leaderboard as
select distinct on (sr.quiz_title, sr.user_id)
  sr.quiz_title,
  sr.user_id,
  p.pseudo,
  p.avatar,
  sr.streak_count as best_streak,
  sr.victory,
  sr.elapsed_seconds,
  sr.themes
from public.streak_results sr
join public.profiles p on p.id = sr.user_id
order by sr.quiz_title, sr.user_id, sr.streak_count desc, sr.victory desc, sr.elapsed_seconds asc;

grant select on public.streak_leaderboard to authenticated;
