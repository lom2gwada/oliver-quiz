-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Liens invités : permet à un admin de partager un quiz avec quelqu'un qui n'a pas de compte Oliver
-- Quiz, pour une réponse "test" (notée, bonne réponse révélée) ou "sondage" (jamais de bilan bon/mauvais
-- montré au répondant, même si `isCorrect` existe toujours dans les questions). Lien partagé, pas
-- nominatif : chaque visite du lien enregistre une nouvelle réponse, pas de blocage à la 2e utilisation.
--
-- Accès anonyme via deux fonctions SECURITY DEFINER plutôt qu'une policy RLS ouverte sur `quizzes` (même
-- conditionnée) : `quizzes`/`guest_links`/`guest_results` restent fermées à `anon`, ces deux fonctions sont
-- le seul point d'entrée public. Même mécanisme que `public.is_admin()` (016_add_quizzes.sql).

create table public.guest_links (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  mode text not null check (mode in ('test', 'survey')),
  label text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.guest_links enable row level security;

create policy "Admins can manage guest links"
  on public.guest_links for all
  using (public.is_admin())
  with check (public.is_admin());

-- Pas de score détaillé par question stocké : `answers` a la forme de `AnswersByQuestion` (déjà utilisée
-- côté client), et la vue d'agrégation recalcule à la volée avec `isCorrect()` (ResultPage.tsx), comme
-- `computeMissedQuestions` le fait déjà pour l'historique authentifié (utils/quizHistory.ts).
create table public.guest_results (
  id uuid primary key default gen_random_uuid(),
  token text not null references public.guest_links(token) on delete cascade,
  respondent_name text not null,
  created_at timestamptz not null default now(),
  answers jsonb not null,
  score int,
  elapsed_seconds int not null default 0
);

create index guest_results_token_idx on public.guest_results (token);

alter table public.guest_results enable row level security;

create policy "Admins can view guest results"
  on public.guest_results for select
  using (public.is_admin());

-- Lit le contenu d'un quiz pour un token de lien invité valide — seul moyen pour un visiteur anonyme
-- d'accéder au contenu d'un quiz, sans jamais ouvrir `quizzes` elle-même en lecture publique.
create or replace function public.fetch_guest_quiz(p_token text) returns jsonb
  language sql security definer stable
  set search_path = public
as $$
  select q.content
  from public.guest_links gl
  join public.quizzes q on q.id = gl.quiz_id
  where gl.token = p_token
$$;

-- Enregistre une réponse invité pour un token valide ; n'insère rien si le token est inconnu/révoqué.
create or replace function public.submit_guest_result(
  p_token text, p_respondent_name text, p_answers jsonb, p_score int, p_elapsed_seconds int
) returns void
  language sql security definer volatile
  set search_path = public
as $$
  insert into public.guest_results (token, respondent_name, answers, score, elapsed_seconds)
  select p_token, p_respondent_name, p_answers, p_score, p_elapsed_seconds
  where exists (select 1 from public.guest_links where token = p_token)
$$;

grant execute on function public.fetch_guest_quiz(text) to anon, authenticated;
grant execute on function public.submit_guest_result(text, text, jsonb, int, int) to anon, authenticated;
