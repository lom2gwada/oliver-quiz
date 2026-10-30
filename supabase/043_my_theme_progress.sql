-- Progression par thème d'un quiz (onglet « Thèmes » de l'historique). Une ligne par thème du quiz, dans l'ordre de sa liste
-- « themes », y compris les thèmes pas encore joués (c'est ce qui reste à découvrir). Ne regarde que les questions qui
-- existent encore dans le quiz et que les lignes de l'appelant (security invoker : RLS de quizzes, question_results et
-- question_progress).
--   seen_count      questions déjà vues, tous modes confondus (même définition que `my_quiz_coverage()`)
--   mastered_count  questions en boîte 4 ou 5 de la révision espacée (`utils/leitner.ts`) : trois bonnes réponses d'affilée
--   attempts / correct_attempts  réponses données (une question répondue deux fois compte deux fois) et parmi elles les bonnes
create or replace function public.my_theme_progress(p_quiz_id uuid)
returns table (
  theme_id text,
  theme_label text,
  question_count int,
  seen_count int,
  mastered_count int,
  attempts int,
  correct_attempts int
)
language sql
stable
security invoker
set search_path = public
as $$
  with quiz as (
    select content from public.quizzes where id = p_quiz_id
  ),
  themes as (
    select t.value ->> 'id' as theme_id, nullif(btrim(t.value ->> 'label'), '') as theme_label, t.theme_order
    from quiz
    cross join lateral jsonb_array_elements(coalesce(quiz.content -> 'themes', quiz.content -> 'categories', '[]'::jsonb)) with ordinality as t (value, theme_order)
  ),
  questions as (
    select e.value ->> 'id' as question_id, coalesce(e.value ->> 'theme', e.value ->> 'category') as theme_id
    from quiz
    cross join lateral jsonb_array_elements(coalesce(quiz.content -> 'questions', '[]'::jsonb)) as e (value)
  ),
  answered as (
    select r.question_id, count(*) as attempts, count(*) filter (where r.correct) as correct_attempts
    from public.question_results r
    where r.user_id = auth.uid() and r.quiz_id = p_quiz_id
    group by r.question_id
  ),
  boxes as (
    select p.question_id, p.box from public.question_progress p where p.user_id = auth.uid() and p.quiz_id = p_quiz_id
  )
  select
    t.theme_id,
    coalesce(t.theme_label, t.theme_id),
    count(q.question_id)::int,
    count(*) filter (where q.question_id is not null and (a.question_id is not null or b.question_id is not null))::int,
    count(*) filter (where b.box >= 4)::int,
    coalesce(sum(a.attempts), 0)::int,
    coalesce(sum(a.correct_attempts), 0)::int
  from themes t
  left join questions q on q.theme_id = t.theme_id
  left join answered a on a.question_id = q.question_id
  left join boxes b on b.question_id = q.question_id
  group by t.theme_id, t.theme_label, t.theme_order
  order by t.theme_order;
$$;

grant execute on function public.my_theme_progress(uuid) to authenticated;
