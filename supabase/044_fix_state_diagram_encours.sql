-- Diagramme d'états des trois questions « Lecture / EnCours / Pause » du quiz « Entrainement aux tests techniques IT »
-- (uml-diag-state-entry-exit, uml-diag-state-composite-nesting, uml-diag-state-composite-exit-order) : dans Mermaid,
-- « EnCours: entry / activerAudio() » ne fait qu'ajouter une description à l'état, et la première description prend la
-- place de son nom. Le sous-état s'affichait donc sous le titre « entry / activerAudio() », sans jamais montrer
-- « EnCours » alors que les questions et les réponses en parlent. On nomme l'état explicitement avant ses descriptions.
-- Idempotent : un diagramme qui nomme déjà l'état n'est pas touché.
update public.quizzes q
set content = jsonb_set(q.content, '{questions}', (
      select jsonb_agg(
        case
          when position(E'        EnCours: entry / activerAudio()' in e.question ->> 'diagram') > 0
               and position('state "EnCours" as EnCours' in e.question ->> 'diagram') = 0
          then jsonb_set(e.question, '{diagram}', to_jsonb(replace(
            e.question ->> 'diagram',
            E'        EnCours: entry / activerAudio()',
            E'        state "EnCours" as EnCours\n        EnCours: entry / activerAudio()')))
          else e.question
        end
        order by e.question_index)
      from jsonb_array_elements(q.content -> 'questions') with ordinality as e (question, question_index)
    )),
    updated_at = now()
where q.title = 'Entrainement aux tests techniques IT'
  and exists (
    select 1 from jsonb_array_elements(q.content -> 'questions') as e (question)
    where position(E'        EnCours: entry / activerAudio()' in e.question ->> 'diagram') > 0
      and position('state "EnCours" as EnCours' in e.question ->> 'diagram') = 0
  );
