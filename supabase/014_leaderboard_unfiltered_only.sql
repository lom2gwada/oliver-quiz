-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Corrige le "laisser-faire" des classements : un joueur pouvait gonfler artificiellement son
-- score/streak/rythme en filtrant sur un thème facile ou un petit sous-ensemble de questions,
-- sans que le classement en tienne compte. Seules les parties jouées sans filtre (tous les
-- thèmes, toutes les difficultés) comptent désormais pour le classement — le filtrage reste
-- possible pour s'entraîner, ces parties restent visibles dans l'historique personnel, elles ne
-- sont simplement plus éligibles au classement.
--
-- Défaut `false` : les lignes déjà enregistrées ne sont pas rétroactivement qualifiées (on ne
-- peut pas savoir de façon fiable, après coup, si un ancien run a été joué sans filtre), donc les
-- classements actuels vont se vider jusqu'à ce que de nouvelles parties sans filtre soient jouées.

alter table public.quiz_results add column unfiltered boolean not null default false;
alter table public.streak_results add column unfiltered boolean not null default false;
alter table public.timed_results add column unfiltered boolean not null default false;

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
where qr.unfiltered
order by qr.quiz_title, qr.user_id, qr.score desc, qr.earned_points desc, qr.elapsed_seconds asc;

grant select on public.leaderboard to authenticated;

create or replace view public.streak_leaderboard as
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
where sr.unfiltered
order by sr.quiz_title, sr.user_id, sr.streak_count desc, sr.victory desc, sr.elapsed_seconds asc;

grant select on public.streak_leaderboard to authenticated;

create or replace view public.timed_leaderboard as
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
where tr.unfiltered
order by tr.quiz_title, tr.user_id,
  (tr.correct_count::numeric / nullif(tr.elapsed_seconds, 0)) desc nulls last,
  tr.correct_count desc;

grant select on public.timed_leaderboard to authenticated;
