-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Ajoute la préférence de thème (clair/sombre) au profil utilisateur.

alter table public.profiles
  add column theme text not null default 'dark' check (theme in ('dark', 'light'));
