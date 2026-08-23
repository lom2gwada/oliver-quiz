-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Stocke un résumé de chaque quiz terminé, pour l'historique et les statistiques du joueur.

create table public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  score int not null check (score between 0 and 100),
  earned_points int not null check (earned_points >= 0),
  total_points int not null check (total_points >= 0),
  elapsed_seconds int not null check (elapsed_seconds >= 0),
  question_count int not null check (question_count >= 0),
  themes text[] not null default '{}',
  by_theme jsonb not null default '{}',
  by_type jsonb not null default '{}',
  by_difficulty jsonb not null default '{}'
);

create index quiz_results_user_id_created_at_idx on public.quiz_results (user_id, created_at desc);

alter table public.quiz_results enable row level security;

create policy "Users can view their own quiz results"
  on public.quiz_results for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quiz results"
  on public.quiz_results for insert
  with check (auth.uid() = user_id);
