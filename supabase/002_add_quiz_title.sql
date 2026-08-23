-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Permet de distinguer les résultats selon le quiz joué (titre du JSON), pour ne pas mélanger
-- les stats de quizzes différents (ex. le quiz d'exemple vs un quiz importé).

alter table public.quiz_results
  add column quiz_title text not null default 'Culture générale';
