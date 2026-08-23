-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Une ligne par question répondue (contrairement à quiz_results qui n'a que des agrégats
-- par partie), pour pouvoir repérer les questions ratées de façon récurrente et proposer
-- de les rejouer spécifiquement.

create table public.question_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  quiz_title text not null,
  question_id text not null,
  question_text text not null,
  correct boolean not null
);

create index question_results_user_id_quiz_title_idx on public.question_results (user_id, quiz_title);

alter table public.question_results enable row level security;

create policy "Users can view their own question results"
  on public.question_results for select
  using (auth.uid() = user_id);

create policy "Users can insert their own question results"
  on public.question_results for insert
  with check (auth.uid() = user_id);
