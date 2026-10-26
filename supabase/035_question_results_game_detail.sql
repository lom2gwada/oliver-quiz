-- Détail d'une partie classique dans l'historique (#167) : de quoi retrouver, pour une partie, ses questions dans l'ordre où
-- elles ont été posées et la réponse donnée. Jusqu'ici `question_results` n'était qu'un journal par question, sans lien avec
-- la partie, et sans la réponse.
--   quiz_result_id : la partie (`quiz_results.id`) ; pas de clé étrangère — les écritures d'une partie partent en parallèle
--                    et rejouables, la ligne de question peut arriver avant celle de la partie ;
--   position       : rang de la question dans la partie (0 = la première) ;
--   answer         : la réponse du joueur telle que l'application la manipule (texte ou liste d'identifiants), `null` sans réponse.
-- Les parties déjà enregistrées n'ont pas ces valeurs : leur détail se limite aux totaux par thème, type et difficulté.
alter table public.question_results
  add column quiz_result_id uuid,
  add column position int,
  add column answer jsonb;

create index question_results_quiz_result_id_idx on public.question_results (quiz_result_id) where quiz_result_id is not null;
