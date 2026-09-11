-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Table dédiée au mode "sans-faute" (streak) : le score y est un nombre de bonnes réponses
-- d'affilée, une métrique incompatible avec quiz_results (score en %), d'où une table séparée
-- plutôt qu'une colonne "mode" qui aurait pollué les stats/graphiques du mode classique.

create table public.streak_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  quiz_title text not null,
  streak_count int not null check (streak_count >= 0),
  elapsed_seconds int not null check (elapsed_seconds >= 0),
  victory boolean not null default false,
  themes text[] not null default '{}'
);

create index streak_results_user_id_created_at_idx on public.streak_results (user_id, created_at desc);

alter table public.streak_results enable row level security;

create policy "Users can view their own streak results"
  on public.streak_results for select
  using (auth.uid() = user_id);

create policy "Users can insert their own streak results"
  on public.streak_results for insert
  with check (auth.uid() = user_id);
