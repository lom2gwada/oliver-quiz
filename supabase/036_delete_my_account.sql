-- « Supprimer mon compte » (#171) : un joueur supprime lui-même son compte et ses données.
-- Supprimer une ligne de `auth.users` exige des droits que le client n'a pas : d'où cette fonction `security definer`,
-- qui ne peut agir que sur le compte de l'appelant (`auth.uid()`).
--
-- Ce qui part avec le compte (clés étrangères `on delete cascade` vers `auth.users`) : le profil, les parties des trois
-- modes, le journal des questions, la progression de révision et les accès aux quiz.
-- Ce qui reste, sans lien avec la personne : les quiz et les liens invités qu'elle avait créés (`created_by` passe à
-- `null` — sans cela la suppression échouerait, ces deux clés n'ont pas de `on delete`), et les réponses des invités,
-- qui ne sont rattachées à aucun compte.
-- Garde-fou : le dernier administrateur ne peut pas supprimer son compte, l'administration deviendrait inaccessible.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = uid and is_admin)
     and not exists (select 1 from public.profiles where is_admin and id <> uid) then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  update public.quizzes set created_by = null where created_by = uid;
  update public.guest_links set created_by = null where created_by = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
