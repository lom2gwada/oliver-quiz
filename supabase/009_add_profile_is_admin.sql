-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Ajoute un statut admin au profil, pour restreindre la vue "Toutes les questions" (réponses
-- comprises) aux utilisateurs de confiance — sinon n'importe qui peut lire les réponses avant
-- de jouer et fausser le classement.
--
-- Pas de policy dédiée : le client (ProfilePage/saveProfile) n'inclut jamais `is_admin` dans le
-- payload d'upsert du formulaire profil, donc la colonne n'est jamais modifiée par un utilisateur
-- via l'app — la seule façon de la changer est une requête SQL manuelle (ex. celle ci-dessous).

alter table public.profiles
  add column is_admin boolean not null default false;

-- Pour se donner (ou donner à quelqu'un) le statut admin :
-- update public.profiles set is_admin = true where id = '<uuid de l''utilisateur>';
