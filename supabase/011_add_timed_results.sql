-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Table dédiée au mode "contre-la-montre" (timed) : comme streak_results, un score en nombre de
-- bonnes réponses n'est pas comparable au % de quiz_results, d'où une table séparée. duration_seconds
-- vaut 0 pour le mode "Infini" (pas de limite, la partie se termine quand le joueur clique "Terminer").

create table public.timed_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  quiz_title text not null,
  correct_count int not null check (correct_count >= 0),
  question_count int not null check (question_count >= 0),
  duration_seconds int not null check (duration_seconds >= 0),
  elapsed_seconds int not null check (elapsed_seconds >= 0),
  themes text[] not null default '{}'
);

create index timed_results_user_id_created_at_idx on public.timed_results (user_id, created_at desc);

alter table public.timed_results enable row level security;

create policy "Users can view their own timed results"
  on public.timed_results for select
  using (auth.uid() = user_id);

create policy "Users can insert their own timed results"
  on public.timed_results for insert
  with check (auth.uid() = user_id);
