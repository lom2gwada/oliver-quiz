-- À exécuter dans le SQL Editor du dashboard Supabase (déjà appliqué en direct via le MCP Supabase).
-- Complète 019_guest_links.sql pour le parcours invité :
-- 1. `fetch_guest_quiz` renvoie désormais aussi le mode du lien ({ mode, quiz }) — sans lui, la page invité ne
--    saurait pas s'il faut noter et corriger (test) ou seulement remercier (sondage).
-- 2. `submit_guest_result` refuse un nom vide/trop long et des réponses démesurées : c'est une fonction
--    appelable par n'importe qui connaissant un token, autant borner ce qu'elle accepte d'écrire.

create or replace function public.fetch_guest_quiz(p_token text) returns jsonb
  language sql security definer stable set search_path = public
as $$
  select jsonb_build_object('mode', gl.mode, 'quiz', q.content)
  from public.guest_links gl
  join public.quizzes q on q.id = gl.quiz_id
  where gl.token = p_token
$$;

create or replace function public.submit_guest_result(
  p_token text, p_respondent_name text, p_answers jsonb, p_score int, p_elapsed_seconds int
) returns void
  language sql security definer volatile set search_path = public
as $$
  insert into public.guest_results (token, respondent_name, answers, score, elapsed_seconds)
  select p_token, btrim(p_respondent_name), p_answers, p_score, greatest(p_elapsed_seconds, 0)
  where exists (select 1 from public.guest_links where token = p_token)
    and char_length(btrim(p_respondent_name)) between 1 and 80
    and octet_length(p_answers::text) <= 200000
    and (p_score is null or p_score between 0 and 100)
$$;
