-- Le journal d'audit (048) accepte aussi les actions de la fonction Edge `admin-users` (#231) : inviter un utilisateur, renvoyer
-- une invitation, envoyer un lien de réinitialisation du mot de passe, changer l'adresse email d'un compte.
--
-- Ces lignes sont écrites par la fonction Edge avec la clé de service (elle passe outre la RLS), et non par `admin_audit()` qui
-- s'appuie sur `auth.uid()`, absent dans ce contexte. Comme pour les autres actions, ni email ni adresse n'y sont conservés : le
-- journal ne garde que les pseudos de l'administrateur et du compte concerné.
--
-- Seule la liste des valeurs permises change ; les 8 actions existantes restent valides, les lignes déjà écrites aussi.
alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action in (
  'disable', 'enable', 'update_profile', 'set_admin', 'reset_progress', 'delete_user', 'grant_access', 'revoke_access',
  'invite_user', 'resend_invite', 'send_password_reset', 'change_email'
));
