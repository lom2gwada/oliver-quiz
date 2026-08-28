-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Vue agrégée pour le classement : meilleur score par utilisateur et par quiz, avec
-- pseudo/avatar. Volontairement une SECURITY DEFINER VIEW (comportement par défaut d'une
-- vue Postgres) : elle tourne avec les droits de son créateur et ignore donc la RLS de
-- `quiz_results`/`profiles` pour cette requête précise, ce qui permet d'exposer un
-- classement agrégé sans toucher à la confidentialité des tables sous-jacentes (chaque
-- utilisateur reste limité à ses propres lignes dans `quiz_results`/`profiles`). Le linter
-- Supabase (`security_definer_view`) signale ça en ERROR par défaut — c'est attendu ici,
-- pas une erreur à corriger.

create view public.leaderboard as
select
  qr.quiz_title,
  qr.user_id,
  p.pseudo,
  p.avatar,
  max(qr.score) as best_score
from public.quiz_results qr
join public.profiles p on p.id = qr.user_id
group by qr.quiz_title, qr.user_id, p.pseudo, p.avatar;

grant select on public.leaderboard to authenticated;
