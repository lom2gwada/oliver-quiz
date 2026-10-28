-- Un joueur auquel un admin a accordé l'accès à un quiz ne le voyait pas (seul le quiz public apparaissait).
--
-- Cause : la policy de lecture de `quizzes` (016, refaite en 020) contient
--   exists (select 1 from quiz_access qa where qa.quiz_id = quizzes.id and qa.user_id = auth.uid())
-- or cette sous-requête s'exécute avec les droits de l'appelant, donc sous la RLS de `quiz_access` — où la seule policy
-- (« Admins manage quiz access », 016) ne laisse lire que les admins. Pour un joueur ordinaire la table paraissait vide :
-- l'accès accordé n'avait aucun effet. (Le commentaire de 016, « un utilisateur normal n'a pas besoin de lire
-- quiz_access », oubliait justement cette sous-requête.)
--
-- Correction : chacun peut lire SES propres lignes d'accès, et seulement elles ; l'écriture reste réservée aux admins.
create policy "Users can view their own quiz access"
  on public.quiz_access for select
  using (user_id = auth.uid());
