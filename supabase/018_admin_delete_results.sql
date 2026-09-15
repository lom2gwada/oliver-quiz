-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Les tables d'historique (quiz_results, question_results, streak_results, timed_results) n'avaient
-- jusqu'ici que des policies select/insert : aucun delete n'était possible côté client, même pour un
-- admin. Nécessaire pour la case « supprimer aussi l'historique » lors de la suppression d'un quiz —
-- admin uniquement, et pas limité à ses propres lignes (sinon l'historique des autres joueurs pour ce
-- quiz resterait), à l'image de la policy "Admins can manage quizzes" déjà en place sur `quizzes`.

create policy "Admins can delete quiz results"
  on public.quiz_results for delete
  using (public.is_admin());

create policy "Admins can delete question results"
  on public.question_results for delete
  using (public.is_admin());

create policy "Admins can delete streak results"
  on public.streak_results for delete
  using (public.is_admin());

create policy "Admins can delete timed results"
  on public.timed_results for delete
  using (public.is_admin());
