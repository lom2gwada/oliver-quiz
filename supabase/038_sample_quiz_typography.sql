-- Orthographe et typographie du quiz d'exemple public (#156), chaîne par chaîne : « composent », guillemets français,
-- espaces insécables avant ? ! : ; % et dans les nombres, N₂ / H₂O, « Ier siècle ». Les mêmes 68 corrections que dans
-- sample-quiz.json, appliquées par id de question (jamais par position). Ne touche que le quiz public de ce titre ; idempotent.
do $$
declare
  change record;
  question_index int;
begin
  for change in select * from (values
    ($t$hist-1$t$, array['question'], to_jsonb($t$Qui a été le premier président de la Ve République française ?$t$::text)),
    ($t$hist-2$t$, array['question'], to_jsonb($t$En quelle année a eu lieu la chute du mur de Berlin ?$t$::text)),
    ($t$hist-3$t$, array['question'], to_jsonb($t$Quel empereur français a été exilé sur l'île de Sainte-Hélène ?$t$::text)),
    ($t$hist-5$t$, array['question'], to_jsonb($t$Quel traité a officiellement mis fin à la Première Guerre mondiale ?$t$::text)),
    ($t$hist-9$t$, array['question'], to_jsonb($t$En quelle année a éclaté la Révolution française ?$t$::text)),
    ($t$geo-1$t$, array['question'], to_jsonb($t$Quelle est la capitale de l'Australie ?$t$::text)),
    ($t$geo-2$t$, array['question'], to_jsonb($t$Quel est le plus grand océan du monde ?$t$::text)),
    ($t$geo-3$t$, array['question'], to_jsonb($t$Quel est le plus long fleuve du monde ?$t$::text)),
    ($t$geo-3$t$, array['explanation'], to_jsonb($t$Le Nil, en Afrique, est traditionnellement considéré comme le plus long fleuve du monde avec environ 6 650 km.$t$::text)),
    ($t$geo-4$t$, array['question'], to_jsonb($t$Quel pays a la plus grande superficie du monde ?$t$::text)),
    ($t$geo-5$t$, array['explanation'], to_jsonb($t$Everest (8 849 m), K2 (8 611 m), Kilimandjaro (5 895 m), Mont Blanc (4 809 m).$t$::text)),
    ($t$geo-9$t$, array['question'], to_jsonb($t$Quelle est l'altitude approximative du Mont Blanc ?$t$::text)),
    ($t$geo-9$t$, array['explanation'], to_jsonb($t$Le Mont Blanc culmine à 4 809 mètres, point culminant des Alpes.$t$::text)),
    ($t$geo-10$t$, array['question'], to_jsonb($t$Quel pays ce drapeau représente-t-il ?$t$::text)),
    ($t$geo-10$t$, array['explanation'], to_jsonb($t$Le drapeau du Brésil arbore un losange doré et un globe bleu sur fond vert, avec la devise « Ordem e Progresso ».$t$::text)),
    ($t$geo-11$t$, array['question'], to_jsonb($t$Quel est ce monument antique ?$t$::text)),
    ($t$geo-11$t$, array['explanation'], to_jsonb($t$Le Colisée, à Rome, est un amphithéâtre construit au Ier siècle qui pouvait accueillir environ 50 000 spectateurs.$t$::text)),
    ($t$sci-1$t$, array['question'], to_jsonb($t$Quel est le symbole chimique de l'or ?$t$::text)),
    ($t$sci-1$t$, array['explanation'], to_jsonb($t$Au vient du latin « aurum », qui signifie or.$t$::text)),
    ($t$sci-2$t$, array['question'], to_jsonb($t$Combien de planètes compte le système solaire ?$t$::text)),
    ($t$sci-3$t$, array['question'], to_jsonb($t$Quelle est l'unité de mesure de la force dans le système international ?$t$::text)),
    ($t$sci-4$t$, array['question'], to_jsonb($t$Quel scientifique a formulé la théorie de la relativité ?$t$::text)),
    ($t$sci-5$t$, array['question'], to_jsonb($t$Quel gaz représente environ 78 % de l'atmosphère terrestre ?$t$::text)),
    ($t$sci-5$t$, array['explanation'], to_jsonb($t$L'azote (N₂) est le composant majoritaire de l'atmosphère, loin devant l'oxygène (environ 21 %).$t$::text)),
    ($t$sci-6$t$, array['explanation'], to_jsonb($t$La lumière voyage à environ 300 000 km/s dans le vide, bien plus vite que le son (environ 340 m/s dans l'air).$t$::text)),
    ($t$sci-7$t$, array['question'], to_jsonb($t$L'eau (H₂O) est composée d'hydrogène et d'___.$t$::text)),
    ($t$sci-8$t$, array['explanation'], to_jsonb($t$Chaque élément possède un symbole issu du tableau périodique : Au (or), Fe (fer), O (oxygène), C (carbone).$t$::text)),
    ($t$sci-9$t$, array['question'], to_jsonb($t$Combien d'os compte le squelette d'un adulte ?$t$::text)),
    ($t$sci-9$t$, array['explanation'], to_jsonb($t$Le squelette humain adulte compte 206 os.$t$::text)),
    ($t$cine-1$t$, array['question'], to_jsonb($t$Qui a réalisé le film « Titanic » (1997) ?$t$::text)),
    ($t$cine-2$t$, array['question'], to_jsonb($t$Dans quelle saga trouve-t-on le personnage de Dark Vador ?$t$::text)),
    ($t$cine-3$t$, array['question'], to_jsonb($t$Quel studio d'animation a produit « Le Roi Lion » (1994) ?$t$::text)),
    ($t$cine-4$t$, array['question'], to_jsonb($t$Quel film a remporté l'Oscar du meilleur film en 2020 ?$t$::text)),
    ($t$cine-6$t$, array['question'], to_jsonb($t$Le film « Avatar » est sorti avant « Titanic » au cinéma.$t$::text)),
    ($t$cine-9$t$, array['question'], to_jsonb($t$En quelle année est sorti le premier film « Star Wars » (Un nouvel espoir) ?$t$::text)),
    ($t$litt-1$t$, array['question'], to_jsonb($t$Qui a écrit « Les Misérables » ?$t$::text)),
    ($t$litt-2$t$, array['question'], to_jsonb($t$Quel auteur français a écrit « Le Petit Prince » ?$t$::text)),
    ($t$litt-3$t$, array['question'], to_jsonb($t$Dans quel pays se déroule l'histoire de « Don Quichotte » ?$t$::text)),
    ($t$litt-4$t$, array['question'], to_jsonb($t$Qui est l'auteur de « Roméo et Juliette » ?$t$::text)),
    ($t$litt-5$t$, array['question'], to_jsonb($t$Quel écrivain français a reçu le prix Nobel de littérature en 1957 ?$t$::text)),
    ($t$litt-6$t$, array['question'], to_jsonb($t$« Harry Potter » a été écrit par J. K. Rowling.$t$::text)),
    ($t$litt-6$t$, array['explanation'], to_jsonb($t$J. K. Rowling a publié le premier tome de la saga Harry Potter en 1997.$t$::text)),
    ($t$litt-7$t$, array['question'], to_jsonb($t$Victor Hugo est l'auteur du roman « Les ___ » (1862).$t$::text)),
    ($t$litt-9$t$, array['question'], to_jsonb($t$En quelle année a été publié « 1984 » de George Orwell ?$t$::text)),
    ($t$sport-1$t$, array['question'], to_jsonb($t$Combien de joueurs composent une équipe de football sur le terrain ?$t$::text)),
    ($t$sport-2$t$, array['question'], to_jsonb($t$Tous les combien d'années ont lieu les Jeux olympiques d'été ?$t$::text)),
    ($t$sport-3$t$, array['question'], to_jsonb($t$Quel pays a remporté la Coupe du monde de football 2018 ?$t$::text)),
    ($t$sport-4$t$, array['question'], to_jsonb($t$Dans quel sport utilise-t-on un volant (« birdie ») ?$t$::text)),
    ($t$sport-5$t$, array['explanation'], to_jsonb($t$100 m, 400 m, 1 500 m, puis le marathon (42,195 km).$t$::text)),
    ($t$sport-5$t$, array['content', 'items', '1', 'label'], to_jsonb($t$100 m$t$::text)),
    ($t$sport-5$t$, array['content', 'items', '2', 'label'], to_jsonb($t$1 500 m$t$::text)),
    ($t$sport-5$t$, array['content', 'items', '3', 'label'], to_jsonb($t$400 m$t$::text)),
    ($t$sport-9$t$, array['question'], to_jsonb($t$Quelle est la distance officielle d'un marathon ?$t$::text)),
    ($t$sport-9$t$, array['explanation'], to_jsonb($t$Un marathon fait 42,195 km, soit environ 42 km.$t$::text)),
    ($t$mus-1$t$, array['question'], to_jsonb($t$Combien de cordes possède une guitare classique ?$t$::text)),
    ($t$mus-2$t$, array['question'], to_jsonb($t$Quel groupe britannique a chanté « Bohemian Rhapsody » ?$t$::text)),
    ($t$mus-3$t$, array['question'], to_jsonb($t$Quel compositeur allemand est devenu sourd avant de composer certaines de ses œuvres majeures ?$t$::text)),
    ($t$mus-4$t$, array['question'], to_jsonb($t$Quel type d'instrument est un Stradivarius ?$t$::text)),
    ($t$mus-5$t$, array['question'], to_jsonb($t$En quelle décennie le mouvement musical « grunge » est-il apparu ?$t$::text)),
    ($t$mus-9$t$, array['question'], to_jsonb($t$En quelle année est sorti l'album « Thriller » de Michael Jackson ?$t$::text)),
    ($t$gastro-1$t$, array['question'], to_jsonb($t$De quel pays la pizza margherita est-elle originaire ?$t$::text)),
    ($t$gastro-2$t$, array['question'], to_jsonb($t$Quel fruit est utilisé pour préparer le guacamole ?$t$::text)),
    ($t$gastro-3$t$, array['question'], to_jsonb($t$Comment appelle-t-on la technique de cuisson à basse température dans un sac hermétique ?$t$::text)),
    ($t$gastro-3$t$, array['explanation'], to_jsonb($t$La cuisson « sous vide » consiste à cuire les aliments à basse température dans un sac scellé sous vide.$t$::text)),
    ($t$gastro-4$t$, array['question'], to_jsonb($t$Quelle boisson accompagne traditionnellement la fondue savoyarde ?$t$::text)),
    ($t$gastro-9$t$, array['question'], to_jsonb($t$À quelle température cuit-on traditionnellement une pizza au four ?$t$::text)),
    ($t$gastro-9$t$, array['explanation'], to_jsonb($t$Une pizza se cuit traditionnellement autour de 250 °C, voire davantage dans un four à bois.$t$::text))
  ) as v (question_id, subpath, new_value)
  loop
    select (t.ordinality - 1)::int into question_index
    from public.quizzes q, jsonb_array_elements(q.content -> 'questions') with ordinality as t (question, ordinality)
    where q.is_public and q.title = 'Culture générale' and t.question ->> 'id' = change.question_id;
    if question_index is not null then
      update public.quizzes
      set content = jsonb_set(content, array['questions', question_index::text] || change.subpath, change.new_value),
          updated_at = now()
      where is_public and title = 'Culture générale';
    end if;
  end loop;
  update public.quizzes
  set content = jsonb_set(content, '{metadata,description}', to_jsonb($t$Quiz d'exemple pour découvrir Oliver Quiz : huit thèmes de culture générale et des questions de plusieurs types, du QCM classique à l'association et au curseur numérique.$t$::text)), updated_at = now()
  where is_public and title = 'Culture générale';
end $$;
