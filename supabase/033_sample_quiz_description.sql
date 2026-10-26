-- Corrige la description du quiz d'exemple public (voir #163) : elle invitait à « importer ton propre quiz », ce que seuls
-- les admins peuvent faire, et annonçait « huit types de questions » alors que le quiz n'en illustre que sept (il n'a
-- pas de question « code »). Le nombre de types n'est plus cité. Idempotent : ne touche que le quiz public de ce titre.
update public.quizzes
set content = jsonb_set(content, '{metadata,description}', to_jsonb($d$Quiz d'exemple pour découvrir Oliver Quiz : huit thèmes de culture générale et des questions de plusieurs types, du QCM classique à l'association et au curseur numérique.$d$::text)),
    updated_at = now()
where is_public and title = 'Culture générale';
