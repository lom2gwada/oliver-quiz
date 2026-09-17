-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Corrige le bug de renommage signalé par l'utilisateur : l'historique/le classement liaient un quiz par
-- son `quiz_title` (texte), pas par son id — renommer un quiz hébergé faisait donc apparaître ses anciennes
-- parties sous l'ancien titre et ses nouvelles sous le nouveau, comme deux quiz différents. Maintenant que
-- tout quiz (le quiz d'exemple compris, cf. 020_public_quizzes.sql) a un id stable, on peut lier par id, avec
-- un repli sur le titre uniquement pour les lignes dont le quiz source a depuis été supprimé.

alter table public.quiz_results add column quiz_id uuid references public.quizzes(id) on delete set null;
alter table public.question_results add column quiz_id uuid references public.quizzes(id) on delete set null;
alter table public.streak_results add column quiz_id uuid references public.quizzes(id) on delete set null;
alter table public.timed_results add column quiz_id uuid references public.quizzes(id) on delete set null;

-- Backfill : relie toute ligne existante dont le titre stocké correspond encore au titre actuel d'un quiz
-- vivant. Vérifié en amont : aucun titre orphelin restant dans les 4 tables (déjà nettoyés en #89), donc ce
-- backfill relie 100% des lignes existantes.
update public.quiz_results t set quiz_id = q.id from public.quizzes q where t.quiz_title = q.title and t.quiz_id is null;
update public.question_results t set quiz_id = q.id from public.quizzes q where t.quiz_title = q.title and t.quiz_id is null;
update public.streak_results t set quiz_id = q.id from public.quizzes q where t.quiz_title = q.title and t.quiz_id is null;
update public.timed_results t set quiz_id = q.id from public.quizzes q where t.quiz_title = q.title and t.quiz_id is null;

-- Les 4 vues de classement groupaient/triaient par `quiz_title` seul — un renommage futur les ferait à nouveau
-- diverger. On les réécrit pour grouper sur `coalesce(quiz_id::text, quiz_title)`, et on affiche le titre
-- actuel du quiz (jointure sur `quizzes`) plutôt que le titre figé au moment de chaque partie, pour qu'un
-- renommage se reflète immédiatement partout sans dépendre de quelle ligne a "gagné" le DISTINCT ON.

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
  qr.quiz_id
from public.quiz_results qr
join public.profiles p on p.id = qr.user_id
left join public.quizzes qz on qz.id = qr.quiz_id
where qr.unfiltered
order by coalesce(qr.quiz_id::text, qr.quiz_title), qr.user_id, qr.score desc, qr.earned_points desc, qr.elapsed_seconds asc;

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
  sr.quiz_id
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
  tr.quiz_id
from public.timed_results tr
join public.profiles p on p.id = tr.user_id
left join public.quizzes qz on qz.id = tr.quiz_id
where tr.unfiltered
order by coalesce(tr.quiz_id::text, tr.quiz_title), tr.user_id,
  (tr.correct_count::numeric / nullif(tr.elapsed_seconds, 0)) desc nulls last,
  tr.correct_count desc;

grant select on public.timed_leaderboard to authenticated;

-- Agrégat (pas un DISTINCT ON) : le titre affiché doit rester hors du GROUP BY pour ne pas re-fragmenter les
-- lignes d'avant/après un renommage — d'où le `max(...)` (constant au sein d'un même groupe, quiz_id ou repli
-- sur le titre orphelin) plutôt qu'une simple colonne groupée.
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
  combined.quiz_id
from (
  select quiz_id, quiz_title, user_id, correct_count, question_count as attempted_count
  from public.quiz_results
  where unfiltered
  union all
  select quiz_id, quiz_title, user_id, streak_count as correct_count,
    streak_count + case when victory then 0 else 1 end as attempted_count
  from public.streak_results
  where unfiltered
  union all
  select quiz_id, quiz_title, user_id, correct_count, question_count as attempted_count
  from public.timed_results
  where unfiltered
) combined
join public.profiles p on p.id = combined.user_id
left join public.quizzes qz on qz.id = combined.quiz_id
group by combined.quiz_id, coalesce(combined.quiz_id::text, combined.quiz_title), combined.user_id, p.pseudo, p.avatar;

grant select on public.overall_leaderboard to authenticated;
