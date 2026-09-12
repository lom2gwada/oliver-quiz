-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Premier pas vers des quiz hébergés (au lieu du seul import de fichier JSON local) : une table
-- `quizzes` (contenu validé stocké tel quel en jsonb — même structure `Quiz` que `parseQuiz`
-- produit déjà pour un fichier importé, aucune migration du format nécessaire) et une table
-- `quiz_access` qui définit qui peut voir quel quiz. Rien n'est accordé par défaut à la création
-- d'un quiz : c'est à l'admin d'accorder l'accès ensuite, au cas par cas.
--
-- Le quiz d'exemple "Culture générale" reste bundlé dans le repo (sample-quiz.json), en dehors de
-- ce système — toujours visible par tous, aucun changement sur son fonctionnement actuel.

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  content jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;

create table public.quiz_access (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

alter table public.quiz_access enable row level security;

-- SECURITY DEFINER : une policy sur `profiles` qui interroge `profiles` directement (par ex.
-- `exists (select 1 from profiles where id = auth.uid() and is_admin)`) provoque une récursion
-- infinie ("infinite recursion detected in policy for relation profiles", 42P17) — la fonction
-- contourne cela en tournant avec les droits de son propriétaire, hors RLS.
create or replace function public.is_admin() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Un utilisateur voit un quiz s'il y a un accès explicite, ou s'il est admin (gestion/publication).
create policy "Users can view quizzes they have access to, admins see all"
  on public.quizzes for select
  using (
    exists (select 1 from public.quiz_access qa where qa.quiz_id = quizzes.id and qa.user_id = auth.uid())
    or public.is_admin()
  );

-- Écriture (créer/mettre à jour/supprimer un quiz) réservée à l'admin.
create policy "Admins can manage quizzes"
  on public.quizzes for all
  using (public.is_admin())
  with check (public.is_admin());

-- quiz_access n'est géré (et lu) que par l'admin — un utilisateur normal n'a pas besoin de voir les
-- lignes d'accès, seulement le résultat (quels quiz apparaissent dans sa liste).
create policy "Admins manage quiz access"
  on public.quiz_access for all
  using (public.is_admin())
  with check (public.is_admin());

-- L'admin doit pouvoir lister tout le monde pour accorder l'accès (jusqu'ici chacun ne voit que sa
-- propre ligne de profil).
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());
