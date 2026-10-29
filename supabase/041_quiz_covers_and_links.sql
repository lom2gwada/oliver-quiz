-- Couvertures et liens « Pour aller plus loin » des quiz hébergés (#211) : `metadata.image` et `metadata.links`, tels qu'ils sont
-- décrits dans src/data/quiz-metadata.json (même contenu : c'est ce fichier que le contrôle hebdomadaire des liens lit).
-- Par identifiant de quiz ; le reste du contenu est inchangé ; idempotent. Le quiz « Le Personal MBA » avait déjà une image et un
-- lien : ils sont repris avec un libellé corrigé (« livre »), un texte alternatif plus parlant et le lien d'achat sans les
-- paramètres de suivi (dont une étiquette d'affiliation tierce).
-- Le Personal MBA
update public.quizzes set content = jsonb_set(jsonb_set(content, '{metadata,image}', $j${"url":"https://m.media-amazon.com/images/I/413PGUKkFNL._SY445_SX342_ML2_.jpg","alt":"Couverture du livre Le Personal MBA, de Josh Kaufman"}$j$::jsonb), '{metadata,links}', $j$[{"label":"Acheter le livre","url":"https://www.amazon.fr/dp/B00CLNPLF8","commercial":true},{"label":"Site de Josh Kaufman (en anglais)","url":"https://personalmba.com"}]$j$::jsonb), updated_at = now() where id = 'f5c4e9b5-9b3c-4407-b703-2ee5e2d4ecd2';

-- L'Art de la Guerre (Sun Tzu)
update public.quizzes set content = jsonb_set(jsonb_set(content, '{metadata,image}', $j${"url":"https://covers.openlibrary.org/b/isbn/9782818504963-L.jpg","alt":"Couverture de L'Art de la guerre, de Sun Tzu, traduit et commenté par Jean Lévi (collection Pluriel)"}$j$::jsonb), '{metadata,links}', $j$[{"label":"L'Art de la guerre sur Wikipédia","url":"https://fr.wikipedia.org/wiki/L%27Art_de_la_guerre"},{"label":"Lire le texte (traduction du domaine public)","url":"https://fr.wikisource.org/wiki/L%E2%80%99Art_de_la_guerre"}]$j$::jsonb), updated_at = now() where id = '294895af-dc2a-4a4c-b5ce-9b656afff47a';

-- L’Art d’avoir toujours raison (Schopenhauer)
update public.quizzes set content = jsonb_set(jsonb_set(content, '{metadata,image}', $j${"url":"https://commons.wikimedia.org/wiki/Special:FilePath/Arthur%20Schopenhauer%20by%20J%20Sch%C3%A4fer%2C%201859b.jpg?width=400","alt":"Portrait photographique d'Arthur Schopenhauer, en 1859, par Johann Schäfer"}$j$::jsonb), '{metadata,links}', $j$[{"label":"L'Art d'avoir toujours raison sur Wikipédia","url":"https://fr.wikipedia.org/wiki/L%27Art_d%27avoir_toujours_raison"},{"label":"Lire le texte sur Wikisource","url":"https://fr.wikisource.org/wiki/L%E2%80%99Art_d%E2%80%99avoir_toujours_raison"}]$j$::jsonb), updated_at = now() where id = 'a4ae74f6-9ba3-418a-80a7-798f64f86017';

-- Scrum — Préparation Certification
update public.quizzes set content = jsonb_set(content, '{metadata,links}', $j$[{"label":"Le Guide Scrum 2020 (PDF, en français)","url":"https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-French.pdf"},{"label":"Le Guide Scrum dans toutes les langues","url":"https://scrumguides.org/download.html"}]$j$::jsonb), updated_at = now() where id = '098a307d-3a0c-408e-a287-57932c14b9bc';

-- Scrum — PSM I Exam Prep
update public.quizzes set content = jsonb_set(content, '{metadata,links}', $j$[{"label":"The Scrum Guide (2020)","url":"https://scrumguides.org/scrum-guide.html"},{"label":"Professional Scrum Master I certification (Scrum.org)","url":"https://www.scrum.org/assessments/professional-scrum-master-i-certification"}]$j$::jsonb), updated_at = now() where id = '275e5cbd-ff4f-45f3-ada3-fe34eb12d737';

-- SAFe 6.0 — Scaled Agile Framework
update public.quizzes set content = jsonb_set(content, '{metadata,links}', $j$[{"label":"Scaled Agile Framework : site officiel","url":"https://framework.scaledagile.com"}]$j$::jsonb), updated_at = now() where id = 'd8cdfa18-4a4d-4527-b4d5-f358fd13074f';

-- Software Craftsmanship
update public.quizzes set content = jsonb_set(content, '{metadata,links}', $j$[{"label":"Le manifeste du Software Craftsmanship (en anglais)","url":"https://manifesto.softwarecraftsmanship.org"}]$j$::jsonb), updated_at = now() where id = 'a836ea31-2c18-4edf-96f8-9c7070faef03';

-- Java — Niveau Expert
update public.quizzes set content = jsonb_set(content, '{metadata,links}', $j$[{"label":"Spécification de la machine virtuelle Java, Java SE 21 (en anglais)","url":"https://docs.oracle.com/javase/specs/jvms/se21/html/index.html"}]$j$::jsonb), updated_at = now() where id = '031c16d7-0584-4e06-aa25-9bf26023e737';

-- Gestion de Projet IT
update public.quizzes set content = jsonb_set(content, '{metadata,links}', $j$[{"label":"Le guide PMBOK (PMI, en anglais)","url":"https://www.pmi.org/standards/pmbok"}]$j$::jsonb), updated_at = now() where id = '2051f131-99a2-4920-966b-31ad9f82be45';
