-- Système de répétition espacée (boîtes de Leitner) pour la section "questions à réviser" de l'historique,
-- qui remplace l'ancienne heuristique par fenêtre glissante sur `question_results`. 5 boîtes : la boîte 1 est
-- la boîte des cartes neuves ou ratées (échéance immédiate), puis l'intervalle avant la prochaine échéance
-- grandit à chaque bonne réponse (voir BOX_INTERVAL_DAYS côté client) ; une mauvaise réponse renvoie
-- toujours en boîte 1. `quiz_id` non nul (pas de repli sur le titre comme les autres tables d'historique) :
-- tous les quiz ont désormais un id stable (#91), et cette table n'a de sens qu'en pouvant retrouver le
-- contenu de la question via `quizzes.content` — `on delete cascade` plutôt que `set null` en découle,
-- une ligne orpheline (quiz supprimé) n'aurait aucun moyen d'être réaffichée.
create table public.question_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  question_id text not null,
  box int not null default 1 check (box between 1 and 5),
  due_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, quiz_id, question_id)
);

create index question_progress_due_idx on public.question_progress (user_id, quiz_id, due_at);

alter table public.question_progress enable row level security;

create policy "Users can view their own question progress"
  on public.question_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own question progress"
  on public.question_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own question progress"
  on public.question_progress for update
  using (auth.uid() = user_id);
