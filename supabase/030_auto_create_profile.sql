-- Crée automatiquement la ligne `profiles` à la création d'un compte (invitation ou « Add user » dans le
-- dashboard Supabase). Sans elle, un nouvel utilisateur n'apparaissait pas dans la liste d'accès d'un quiz
-- (alimentée par `profiles`) tant qu'il n'avait pas enregistré lui-même un pseudo.
--
-- Pseudo par défaut : « Joueur-xxxx » (4 premiers caractères de l'id), PAS un extrait de l'email — le pseudo
-- est affiché aux autres joueurs dans les classements, un préfixe d'email y exposerait une donnée personnelle.
-- Le joueur le change quand il veut depuis son profil. `on conflict do nothing` : jamais d'écrasement, et un
-- profil déjà créé à la main ne bloque pas l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo)
  values (new.id, 'Joueur-' || substr(replace(new.id::text, '-', ''), 1, 4))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
