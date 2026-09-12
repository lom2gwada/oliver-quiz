-- À exécuter dans le SQL Editor du dashboard Supabase.
-- 4ème classement, "général" : contrairement aux 3 autres (qui ne gardent que la meilleure partie
-- de chaque joueur), celui-ci cumule le nombre de bonnes réponses sur TOUTES les parties non
-- filtrées, tous modes confondus — la seule "monnaie commune" partagée par les 3 modes (un score
-- en %, un streak et un rythme ne sont pas directement comparables entre eux, cf. 014). Le taux de
-- réussite global n'est qu'une information affichée, pas le critère de tri principal — sinon
-- quelques parties parfaites battraient un gros volume de bonnes réponses avec un excellent taux.
--
-- `quiz_results.correct_count` (nombre de questions correctes, pas de points) n'existait pas avant
-- cette migration : les lignes déjà enregistrées y auront `0` par défaut, mais elles ont de toute
-- façon `unfiltered = false` (voir 014) donc ne comptent pas ici — aucune incohérence.

alter table public.quiz_results add column correct_count int not null default 0;

create view public.overall_leaderboard as
select
  combined.quiz_title,
  combined.user_id,
  p.pseudo,
  p.avatar,
  sum(combined.correct_count) as total_correct,
  sum(combined.attempted_count) as total_attempted,
  round(sum(combined.correct_count)::numeric / nullif(sum(combined.attempted_count), 0) * 100, 1) as success_rate,
  count(*) as games_played
from (
  select quiz_title, user_id, correct_count, question_count as attempted_count
  from public.quiz_results
  where unfiltered
  union all
  select quiz_title, user_id, streak_count as correct_count,
    streak_count + case when victory then 0 else 1 end as attempted_count
  from public.streak_results
  where unfiltered
  union all
  select quiz_title, user_id, correct_count, question_count as attempted_count
  from public.timed_results
  where unfiltered
) combined
join public.profiles p on p.id = combined.user_id
group by combined.quiz_title, combined.user_id, p.pseudo, p.avatar;

grant select on public.overall_leaderboard to authenticated;
