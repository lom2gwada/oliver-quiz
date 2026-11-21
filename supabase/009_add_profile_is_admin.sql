-- À exécuter dans le SQL Editor du dashboard Supabase.
-- Ajoute un statut admin au profil, pour restreindre la vue "Toutes les questions" (réponses
-- comprises) aux utilisateurs de confiance — sinon n'importe qui peut lire les réponses avant
-- de jouer et fausser le classement.
--
-- Pas de policy dédiée : le client (ProfilePage/saveProfile) n'inclut jamais `is_admin` dans le
-- payload d'upsert du formulaire profil. ATTENTION : cela ne suffisait PAS — les politiques RLS (004) ne portent que
-- sur les lignes, et `authenticated` pouvait écrire toutes les colonnes de sa propre ligne, `is_admin` comprise, en
-- appelant l'API directement. Corrigé par 046_profiles_column_privileges.sql (droits par colonne) : depuis, la seule façon
-- de changer `is_admin` est une fonction `security definer` d'administration ou une requête SQL manuelle (ex. ci-dessous).

alter table public.profiles
  add column is_admin boolean not null default false;

-- Pour se donner (ou donner à quelqu'un) le statut admin :
-- update public.profiles set is_admin = true where id = '<uuid de l''utilisateur>';
