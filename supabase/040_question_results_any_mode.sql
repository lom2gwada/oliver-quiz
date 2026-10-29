-- Détail des parties de tous les modes (#209). Jusqu'ici `question_results.quiz_result_id` (035) ne reliait une question
-- qu'à une partie classique. Deux colonnes génériques disent désormais de quelle partie il s'agit :
--   game_mode : 'classic' | 'streak' | 'timed' (la table de résultats où se trouve la partie) ;
--   game_id   : l'identifiant de la partie dans cette table (quiz_results, streak_results ou timed_results).
-- Pas de clé étrangère : les écritures d'une partie partent en parallèle et sont rejouables (voir 035).
-- Les lignes déjà reliées à une partie classique sont reprises ; `quiz_result_id` reste en place (un onglet resté ouvert
-- avec l'ancienne version continue d'écrire dedans, le client lit les deux). En contre-la-montre une même question peut
-- revenir : `position` est le rang de la tentative.
alter table public.question_results
  add column game_mode text check (game_mode in ('classic', 'streak', 'timed')),
  add column game_id uuid;

update public.question_results
set game_mode = 'classic', game_id = quiz_result_id
where quiz_result_id is not null and game_id is null;

create index question_results_game_id_idx on public.question_results (game_id) where game_id is not null;
