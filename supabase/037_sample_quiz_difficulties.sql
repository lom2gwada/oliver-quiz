-- Recalibrage des difficultés du quiz d'exemple public (#155), question par question : une étiquette « Difficile »
-- sur « Quel gaz représente 78 % de l'atmosphère ? » ne correspondait pas au ressenti. La règle suivie est écrite dans le
-- README (« Choisir la difficulté »). Ne touche que les 10 questions listées, dans le quiz public de ce titre ; idempotent.
update public.quizzes q
set content = jsonb_set(q.content, '{questions}', (
      select jsonb_agg(
               case when m.difficulty is null then t.question else jsonb_set(t.question, '{difficulty}', to_jsonb(m.difficulty)) end
               order by t.position)
      from jsonb_array_elements(q.content -> 'questions') with ordinality as t (question, position)
      left join (values
    ('hist-5', 'medium'),
    ('hist-9', 'easy'),
    ('geo-1', 'medium'),
    ('geo-9', 'hard'),
    ('sci-4', 'easy'),
    ('sci-5', 'medium'),
    ('sci-7', 'easy'),
    ('sport-5', 'easy'),
    ('mus-6', 'medium'),
    ('gastro-5', 'medium')
    ) as m (id, difficulty) on m.id = t.question ->> 'id'
    )),
    updated_at = now()
where q.is_public and q.title = 'Culture générale';
