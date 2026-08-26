-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Une ligne par utilisateur (contrairement à quiz_results/question_results qui ont plusieurs
-- lignes par utilisateur), pour stocker le pseudo et l'avatar affichés dans l'app.

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  pseudo text not null check (char_length(trim(pseudo)) between 1 and 30),
  avatar text not null default '🙂',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
