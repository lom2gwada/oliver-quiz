-- Questions déjà découvertes d'un quiz, pour l'option « Seulement des questions non découvertes » de l'accueil.
-- Même définition que `my_quiz_coverage()` (028) : une question est « découverte » dès qu'elle figure dans `question_results`
-- (journal de chaque partie, tous modes depuis 040) ou dans `question_progress` (révision espacée), et seules comptent
-- les questions encore présentes dans le quiz — une question supprimée depuis par un admin n'est pas renvoyée.
-- Renvoie UN tableau plutôt qu'une ligne par question : PostgREST plafonne le nombre de lignes d'une réponse (1000 par défaut)
-- et certains quiz comptent plus de questions que cela.
-- `security invoker` : la RLS de quizzes, question_results et question_progress s'applique (et `auth.uid()` ne voit que ses lignes).
create or replace function public.my_seen_question_ids(p_quiz_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = public
as $$
  with current_questions as (
    select e.value ->> 'id' as question_id
    from public.quizzes q
    cross join lateral jsonb_array_elements(coalesce(q.content -> 'questions', '[]'::jsonb)) as e (value)
    where q.id = p_quiz_id
  ),
  seen as (
    select r.question_id from public.question_results r where r.user_id = auth.uid() and r.quiz_id = p_quiz_id
    union
    select p.question_id from public.question_progress p where p.user_id = auth.uid() and p.quiz_id = p_quiz_id
  )
  select coalesce(array_agg(distinct cq.question_id), '{}'::text[])
  from current_questions cq
  join seen s on s.question_id = cq.question_id;
$$;

grant execute on function public.my_seen_question_ids(uuid) to authenticated;
