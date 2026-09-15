-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Ajoute la préférence de langue d'interface (français/anglais) au profil utilisateur — même mécanisme
-- que la préférence de thème (008_add_profile_theme.sql).

alter table public.profiles
  add column language text not null default 'fr' check (language in ('fr', 'en'));
