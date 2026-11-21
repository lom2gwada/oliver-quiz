-- Un joueur ne doit pouvoir écrire que les colonnes de son profil qui lui appartiennent (#228).
--
-- Jusqu'ici le rôle `authenticated` avait INSERT, UPDATE et DELETE sur TOUTE la table `profiles`, et les politiques RLS
-- (004) ne portent que sur les LIGNES (« la sienne »), pas sur les colonnes : la protection de `is_admin` (009) reposait
-- uniquement sur le fait que l'application ne l'envoie pas, ce que l'API publique n'impose à personne.
--
-- Correction : droits par colonne. Un joueur peut écrire `pseudo`, `avatar`, `theme` et `language` de son propre profil
-- (ce que fait `saveProfile`, un upsert), rien d'autre. `is_admin` et `created_at` ne se changent plus que par une fonction
-- `security definer` d'administration ou par le SQL du dashboard, et `id` n'est qu'insérable (c'est `auth.uid()` par défaut,
-- et la politique d'insertion exige qu'il soit celui de l'appelant). Plus aucun DELETE : l'application ne supprime jamais
-- un profil directement, il part avec son compte (`on delete cascade`, voir 036).
--
-- Sans effet sur ce qui s'exécute avec les droits du propriétaire : le trigger `handle_new_user` (030), `is_admin()` (016),
-- `delete_my_account()` (036), ni sur `service_role`. Une révocation sur la table retire aussi les droits par colonne
-- correspondants ; on accorde donc ensuite uniquement les colonnes voulues. Rejouable sans effet de bord.
revoke insert, update, delete on public.profiles from authenticated;
grant insert (id, pseudo, avatar, theme, language) on public.profiles to authenticated;
grant update (pseudo, avatar, theme, language) on public.profiles to authenticated;
