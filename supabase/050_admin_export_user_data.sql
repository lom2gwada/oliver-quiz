-- Export des données d'un utilisateur (#232) : droit d'accès. Depuis sa fiche, un administrateur télécharge tout ce qu'Oliver Quiz
-- conserve sur la personne, en JSON.
--
-- `admin_export_user_data(p_user_id)` : `security definer`, réservée aux administrateurs (`is_admin()` en premier, aucun droit pour
-- `anon`). Elle renvoie UN document jsonb :
--   account                   id, email, dates de création et de dernière connexion, compte désactivé ou non. JAMAIS le mot de
--                             passe ni son empreinte, ni aucune autre colonne de `auth.users`.
--   profile                   la ligne de `profiles`
--   quiz_access               les quiz auxquels un administrateur lui a donné accès, avec leur titre
--   quiz_results, streak_results, timed_results, question_results, question_progress
--                             toutes ses lignes, telles qu'enregistrées
--   admin_actions_on_account  ce que des administrateurs ont fait sur son compte (journal d'audit : qui, quoi, quand)
-- Périmètre : Oliver Quiz seulement. Le compte étant commun à Quiz Forge et Periodic Quiz (tables `quiz_forge_*` et `periodic_*`),
-- leurs données NE SONT PAS dans cet export ; le champ `scope` le dit.
--
-- L'export est lui-même inscrit au journal d'audit (`export_user_data`) : lire une fiche est banal, sortir toutes les données d'une
-- personne ne l'est pas. Comme pour les autres actions, le journal ne garde que les pseudos, pas d'email.

alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action in (
  'disable', 'enable', 'update_profile', 'set_admin', 'reset_progress', 'delete_user', 'grant_access', 'revoke_access',
  'invite_user', 'resend_invite', 'send_password_reset', 'change_email',
  'export_user_data'
));

create or replace function public.admin_export_user_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_pseudo text;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select pseudo into target_pseudo from public.profiles where id = p_user_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'scope', 'oliver-quiz',
    'exported_at', now(),
    'account', (
      select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                                'disabled', coalesce(u.banned_until > now(), false))
      from auth.users u where u.id = p_user_id
    ),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user_id),
    'quiz_access', (
      select coalesce(jsonb_agg(jsonb_build_object('quiz_id', a.quiz_id, 'quiz_title', q.title, 'granted_at', a.granted_at) order by a.granted_at), '[]'::jsonb)
      from public.quiz_access a join public.quizzes q on q.id = a.quiz_id where a.user_id = p_user_id
    ),
    'quiz_results', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) from public.quiz_results r where r.user_id = p_user_id),
    'streak_results', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) from public.streak_results r where r.user_id = p_user_id),
    'timed_results', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) from public.timed_results r where r.user_id = p_user_id),
    'question_results', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at, r.position), '[]'::jsonb) from public.question_results r where r.user_id = p_user_id),
    'question_progress', (select coalesce(jsonb_agg(to_jsonb(r) order by r.updated_at), '[]'::jsonb) from public.question_progress r where r.user_id = p_user_id),
    'admin_actions_on_account', (
      select coalesce(jsonb_agg(jsonb_build_object('created_at', l.created_at, 'admin_pseudo', l.admin_pseudo, 'action', l.action, 'details', l.details) order by l.created_at), '[]'::jsonb)
      from public.admin_audit_log l where l.target_id = p_user_id
    )
  ) into result;

  perform public.admin_audit('export_user_data', p_user_id, target_pseudo);
  return result;
end;
$$;

revoke all on function public.admin_export_user_data(uuid) from public, anon;
grant execute on function public.admin_export_user_data(uuid) to authenticated;
