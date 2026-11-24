# Oliver Quiz

Application web de quiz construite avec React, TypeScript et Vite. Elle permet de s'entraîner sur des questions à choix multiples, du code, du texte libre, du réordonnancement, du vrai/faux, du texte à trous, de l'association ou de l'estimation numérique, filtrées par thème et niveau de difficulté.

## Fonctionnalités

- Huit types de questions : QCM, code, texte libre, ordonnancement, vrai/faux, texte à trous, association et estimation numérique (`src/components`)
- Filtrage des questions par thème et par difficulté (`src/components/FilterPanel.tsx`)
- Tirage aléatoire d'un nombre de questions choisi par l'utilisateur
- Import d'un quiz personnalisé au format JSON, validé avant utilisation (`src/utils/quizValidation.ts`)
- Un quiz d'exemple est fourni dans [`src/data/sample-quiz.json`](src/data/sample-quiz.json)

## Prérequis

- [Node.js](https://nodejs.org/) 18 ou plus récent

## Installation

```bash
git submodule update --init   # (ou cloner avec --recurse-submodules)
npm install
```

Une partie du code est partagée avec Quiz Caraïbes et Periodic Quiz : elle vit dans le dépôt [`quiz-engine`](https://github.com/lom2gwada/quiz-engine), inclus comme sous-module git dans `engine/` et importé via l'alias `@engine/...`. Pour récupérer une nouvelle version du moteur : `git -C engine pull`, puis commiter le nouveau pointeur.

## Authentification

L'accès au site est protégé par [Supabase Auth](https://supabase.com/docs/guides/auth) (connexion par email/mot de passe uniquement, pas d'inscription publique).

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans **Authentication > Users**, crée manuellement un compte pour chaque personne autorisée.
3. Copie `.env.local.example` vers `.env.local` et renseigne l'URL du projet et la clé `anon` (**Project Settings > API**) :
   ```bash
   cp .env.local.example .env.local
   ```
4. Pour un déploiement (ex. GitHub Actions), définis `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` comme secrets du dépôt et passe-les à l'étape de build.

La clé `anon` est prévue pour être publique (elle finit de toute façon dans le bundle JS envoyé au navigateur) ; elle n'accorde par elle-même aucun accès aux données, elle sert uniquement à parler à l'API Supabase.

## Qui peut administrer un quiz

Deux niveaux, tous contrôlés **dans la base** (migration `051_quiz_admins.sql` : RLS et fonctions `security definer`), jamais seulement dans l'interface :

- **Administrateur global** (`profiles.is_admin`) : tous les quiz, la page Utilisateurs.
- **Par quiz** (`quiz_admins`) : le **propriétaire** (le créateur, plus ceux qu'un propriétaire promeut) et l'**administrateur**.

| Droit | Global | Propriétaire | Administrateur |
|---|---|---|---|
| Contenu (questions, thèmes, titre, couverture, liens, import et export JSON) | ✅ | ✅ | ✅ |
| Accès des joueurs, liens invités et leurs résultats | ✅ | ✅ | ✅ |
| Rendre le quiz public | ✅ | ✅ | ❌ |
| Ajouter, retirer, promouvoir, rétrograder des administrateurs | ✅ | ✅ | ❌ |
| Supprimer le quiz (et, au choix, l'historique des joueurs) | ✅ | ✅ | ❌ |

Pour qu'aucun droit ne se contourne depuis un client modifié : un administrateur de quiz n'a **aucune policy d'écriture directe** sur `quizzes`. Créer, modifier, rendre public et supprimer passent par `upsert_quiz`, `update_quiz`, `set_quiz_public` et `delete_quiz`. `update_quiz` reçoit la version (`updated_at`) que l'appelant a chargée et refuse (`conflict`) si le quiz a changé depuis : deux administrateurs ne s'écrasent pas. Ni `last_owner` (jamais le dernier propriétaire) ni `sole_quiz_owner` (un compte seul propriétaire d'un quiz ne peut pas être supprimé) ne se contournent.

Un administrateur de quiz ne lit pas `profiles` : il cherche un compte par **pseudo** (`quiz_search_users`), la réponse ne contient jamais d'email.

Dans l'application : la page **Quiz** est ouverte à qui administre au moins un quiz (elle n'en liste que les siens, avec son rôle) ; la page **Utilisateurs** reste réservée à l'administrateur global. Sur la fiche d'un quiz, l'onglet **Administrateurs** liste les propriétaires et administrateurs (un propriétaire en ajoute par recherche de pseudo, les retire, les promeut ou les rétrograde, avec confirmation ; un administrateur simple peut se retirer lui-même), et les onglets Accès et Liens invités suivent les droits du compte. **Créer un quiz** : l'administrateur global, ou un compte qu'il y a autorisé (page Utilisateurs, fiche du compte, « Création de quiz » ; désactivé par défaut, retirer l'autorisation ne retire aucun quiz déjà créé). Un compte autorisé est soumis à des plafonds contrôlés en base (`quiz_creator_limits()`, migration 052 : 10 quiz créés au plus, 3 Mo de JSON au plus par quiz) ; l'administrateur global en est exempté. Le titre d'un quiz reste unique pour tous : qui peut créer apprend, par « titre non disponible », qu'un quiz de ce titre existe, jamais à qui il appartient ni son contenu ; qui ne peut pas créer ne l'apprend jamais.

### Modifier une question en jouant

Qui administre le quiz joué (administrateur global, propriétaire ou administrateur du quiz) voit un bouton **Modifier** sur la page de jeu, dans les trois modes (classique et révision, sans-faute, contre-la-montre) : il ouvre le formulaire d'édition de la question affichée dans une fenêtre. L'enregistrement passe par la même fonction que l'onglet Questions (droits et version du quiz contrôlés en base ; en cas de conflit, la fenêtre reste ouverte avec le message). Pendant que la fenêtre est ouverte, **les chronomètres sont en pause**. Après enregistrement, la partie en cours utilise tout de suite la nouvelle version, y compris pour le bilan et ses points ; la réponse déjà saisie est conservée si seuls l'énoncé, la difficulté, les points, etc. changent, et **vidée** si les réponses proposées ou le type changent. Le bouton n'existe pas pour un joueur, sur un lien invité ni sur le quiz par défaut. La partie est enregistrée normalement (c'est une partie de test).

### Journal de gestion des quiz

Les actions de **gestion** d'un quiz (pas chaque modification de question) s'inscrivent au journal d'audit (`admin_audit_log`, migration `053_quiz_admin_audit.sql`) : création et suppression d'un quiz (avec ou sans l'historique des parties), quiz rendu public ou privé, administrateur ajouté, retiré, promu, rétrogradé (ou parti de lui-même), accès d'un joueur accordé ou retiré, autorisation de créer des quiz accordée ou retirée. **Chaque ligne est écrite par la fonction SQL qui fait l'action**, jamais par l'interface : impossible de l'oublier, ni de l'écrire sans que l'action ait eu lieu. Une action sans effet (rôle déjà le bon, quiz déjà public…) ne laisse aucune ligne. Le quiz est désigné par son **titre au moment de l'action** (`details.quiz_title`) et son identifiant (`details.quiz_id`, d'où la colonne générée `quiz_id`, qui retrouve aussi les lignes d'un quiz supprimé depuis). Le journal ne contient que des **pseudos, jamais d'email**.

Qui le lit : l'administrateur global lit tout (l'onglet **Journal** de chaque quiz, le **Journal des quiz** en bas de la page Quiz — y compris les quiz supprimés — et la fiche de chaque utilisateur) ; le **propriétaire** lit celui de ses quiz (onglet **Journal**, via `quiz_audit_log(quiz_id)`) ; un simple administrateur du quiz et les joueurs n'y ont pas accès.

**Suppression d'un compte** : un compte qui est le seul propriétaire d'un quiz ne peut pas être supprimé (`sole_quiz_owner`). La fiche de l'utilisateur et « Supprimer mon compte » le disent et listent les quiz concernés : il faut d'abord nommer un autre propriétaire, ou supprimer ces quiz.

**`created_by`** garde l'**auteur d'origine** du quiz (il passe à `null` si son compte est supprimé) ; la **propriété** est dans `quiz_admins`. On peut donc être propriétaire sans être l'auteur, et l'auteur peut ne plus être propriétaire. Le plafond de 10 quiz compte les quiz dont on est l'auteur, pas ceux dont on est propriétaire.

## Fonction Edge `admin-users` (inviter et gérer les comptes)

Inviter une adresse, renvoyer une invitation, envoyer un lien de réinitialisation du mot de passe et changer l'adresse email d'un compte passent par l'API d'administration de l'authentification, qui exige la clé de service : ni le navigateur ni une fonction SQL ne peuvent s'en servir. D'où la fonction Edge [`supabase/functions/admin-users`](supabase/functions/admin-users) (logique dans `handler.ts`, testée avec Vitest ; `index.ts` la branche sur `supabase-js`). Les boutons « Inviter » et « Compte et connexion » de la page **Utilisateurs** (administration) l'appellent ; sans elle ils affichent « fonction injoignable ».

Ce qu'elle garantit : elle vérifie le jeton de l'appelant, puis qu'il est administrateur (`profiles.is_admin`) et que son compte n'est pas désactivé, **avant toute action** ; elle n'accepte que les origines de l'application (CORS) ; les liens mènent toujours à `APP_URL`, jamais à une adresse fournie par le client ; chaque action est inscrite au journal d'audit, sans email.

### Déployer

1. Appliquer les migrations [`048_admin_user_actions.sql`](supabase/048_admin_user_actions.sql) et [`049_admin_audit_account_actions.sql`](supabase/049_admin_audit_account_actions.sql) (SQL Editor).
2. Déployer la fonction avec le [CLI Supabase](https://supabase.com/docs/guides/cli) (`<réf>` : **Project Settings > General > Reference ID**) :
   ```bash
   npx supabase login
   npx supabase functions deploy admin-users --project-ref <réf>
   ```
   Le jeton est exigé par le serveur (`verify_jwt = true`, voir [`supabase/config.toml`](supabase/config.toml)). Redéployer de la même façon après une modification du dossier.
3. **Aucun secret à créer** : `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par Supabase à la fonction. La clé de service reste dans son environnement : elle n'est ni dans ce dépôt ni dans le navigateur.
4. Facultatif, avec `npx supabase secrets set NOM=valeur --project-ref <réf>` : `APP_URL` (où mènent les liens ; par défaut `https://lom2gwada.github.io/oliver-quiz/`) et `ALLOWED_ORIGINS` (origines autorisées, séparées par des virgules ; par défaut le site publié et `http://localhost:5173` à `5175`).

### Réglages de Supabase dont elle dépend

- **Authentication > URL Configuration** : `APP_URL` doit figurer dans **Redirect URLs** (en plus de la *Site URL*). Sinon Supabase ignore la redirection et le lien de l'email arrive sans jeton : l'invité atterrit sur l'écran de connexion au lieu de « Définir mon mot de passe » (le bug de la PR #28).
- **Envoi des emails** : le service d'envoi intégré de Supabase est très limité (quelques emails par heure) ; au-delà, l'interface affiche « Trop d'emails envoyés récemment ». Pour inviter régulièrement, configurer un SMTP personnalisé dans **Authentication > SMTP Settings**.
- Le compte est **commun à Oliver Quiz, Quiz Forge et Periodic Quiz** : l'invitation crée donc aussi l'accès aux deux autres, et changer l'email le change partout.

### Vérifier après un déploiement

Sans jeton d'administrateur la fonction doit refuser : `curl -i -X POST https://<réf>.supabase.co/functions/v1/admin-users` répond `401`. Le reste se vérifie depuis l'application, avec un compte administrateur.

## Scripts disponibles

| Commande          | Description                                      |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Démarre le serveur de développement Vite           |
| `npm run build`   | Vérifie les types puis génère le build de production |
| `npm run preview` | Prévisualise le build de production en local       |
| `npm test`        | Lance les tests unitaires (Vitest)                 |
| `npm run test:watch` | Lance les tests unitaires en mode watch         |
| `npm run test:coverage` | Lance les tests avec un rapport de couverture |

## Format d'un quiz JSON

Un fichier de quiz doit respecter le contrat défini dans [`src/types/quiz.ts`](src/types/quiz.ts) et validé par [`parseQuiz`](src/utils/quizValidation.ts). Voir [`src/data/sample-quiz.json`](src/data/sample-quiz.json) pour un exemple complet.

Le plus simple pour démarrer : dans l'administration (page « Quiz »), le bouton **Télécharger un modèle** donne un quiz minimal et valide avec un exemple de chaque type de question ; il sert aussi de référence pour les exemples ci-dessous.

### Structure

```json
{
  "version": "1.0",
  "metadata": { "title": "…", "author": "…", "createdAt": "2026-10-27", "description": "…", "language": "fr" },
  "themes": [{ "id": "histoire", "label": "Histoire" }],
  "questions": [ { "id": "q1", "type": "qcm", "theme": "histoire", "difficulty": "easy", "question": "…", "tags": [], "explanation": "…", "points": 1, "content": { } } ]
}
```

- **Racine** : `version` (texte, ex. `"1.0"`), `metadata`, `themes`, `questions`.
- **`metadata`** : `title`, `author`, `createdAt` (textes obligatoires) ; `description`, `language` (code `fr`, `en`…) facultatifs ; `image` et `links` facultatifs (voir plus bas). Le titre identifie le quiz : republier un fichier de même titre le met à jour.
- **`themes`** : liste de `{ id, label }`. Chaque question référence un `id` de cette liste.
- **Champs communs d'une question** : `id` (texte, unique dans le quiz), `type`, `theme`, `difficulty` (`easy`, `medium` ou `hard`), `question` (l'énoncé), `explanation` (la correction affichée), `points` (nombre ≥ 0), `tags` (liste de textes, peut être vide), `content` (selon le type).
- **Champs facultatifs d'une question** : `imageUrl` + `imageAlt` (image sous l'énoncé), `diagram` (diagramme [Mermaid](https://mermaid.js.org)), `table` (`{ headers?, rows }`, toutes les lignes ayant autant de colonnes que l'en-tête), `timeLimitSeconds` (temps limite propre à la question, nombre > 0).

### Les huit types de questions (`content`)

| `type` | `content` |
| --- | --- |
| `qcm` | `{ "multiple": false, "answers": [{ "id": "a", "label": "Paris", "isCorrect": true }, …] }` — `multiple: true` pour plusieurs bonnes réponses |
| `code` | `{ "language": "javascript", "snippet": "…", "multiple": false, "answers": […] }` — un extrait de code et des réponses comme un QCM (`multiple` facultatif) |
| `text` | `{ "expectedAnswers": ["Pacifique", "Océan Pacifique"], "caseSensitive": false }` — réponse libre, toute valeur de la liste est acceptée |
| `ordering` | `{ "items": [{ "id": "p1", "label": "Mercure" }, …], "correctOrder": ["p1", "p2", "p3"] }` — `correctOrder` contient chaque `id` d'`items` une fois |
| `boolean` | `{ "isTrue": true }` |
| `cloze` | `{ "expectedAnswers": ["Rome"], "caseSensitive": false }` — l'énoncé (`question`) doit contenir le trou `___` |
| `matching` | `{ "left": [{ "id": "l1", "label": "France" }, …], "right": [{ "id": "r1", "label": "Paris" }, …], "correctPairs": { "l1": "r1", … } }` — une correspondance par élément de `left` |
| `numeric` | `{ "min": 1700, "max": 1900, "step": 1, "target": 1789, "tolerance": 0, "unit": "ans" }` — `min` < `max`, `target` entre les deux, `tolerance` ≥ 0, `unit` facultatif |

### Choisir la difficulté

La difficulté (`easy`, `medium`, `hard`) doit correspondre au ressenti d'un joueur adulte, pas à la forme de la question. Règle suivie pour le quiz d'exemple et recommandée pour les autres :

| Niveau | Quand l'utiliser | Exemples du quiz d'exemple |
| --- | --- | --- |
| **Facile** (`easy`) | Culture générale courante, vue à l'école ou dans la vie quotidienne ; la bonne réponse se reconnaît ou se retrouve sans effort. | « Quel est le symbole chimique de l'or ? », « Combien de planètes compte le système solaire ? » |
| **Intermédiaire** (`medium`) | Un fait précis à se rappeler (réponse à écrire, date à estimer, ordre ou association de plusieurs éléments), ou une réponse connue mais qui piège facilement. | « Quel gaz représente environ 78 % de l'atmosphère ? », « Quelle est la capitale de l'Australie ? » |
| **Difficile** (`hard`) | Connaissance spécialisée, détail rarement retenu ou valeur précise ; ou un classement où l'ordre intuitif est faux. | « Quel écrivain français a reçu le prix Nobel de littérature en 1957 ? », « Classez ces films Star Wars par ordre de sortie » |

En cas d'hésitation : le type de question ne fait pas la difficulté (un QCM peut être difficile, une réponse libre facile) ; on se demande combien de joueurs répondraient juste sans aide. Viser un mélange dans chaque thème, avec une majorité de Facile et d'Intermédiaire.

### Erreurs de validation

Un fichier refusé affiche l'erreur avec le **chemin du champ fautif**, par exemple :

- `metadata.title : texte attendu.`
- `themes[1].label : texte attendu.`
- `questions[3].points : nombre positif ou nul attendu. (question « q4 »)`
- `questions[0].content.answers[2].isCorrect : true ou false attendu. (question « qcm-1 »)`
- `questions[5].theme : thème « inconnu » inconnu (question « q6 ») : chaque question doit référencer un thème existant de la liste « themes ».`

`questions[3]` est la quatrième question du fichier (la numérotation part de 0).

### Métadonnées facultatives : image et liens

Outre `title`, `author`, `createdAt`, `description` et `language`, `metadata` accepte deux champs optionnels (un quiz qui n'en a pas reste valide) :

```json
"metadata": {
  "title": "Le Personal MBA",
  "author": "…",
  "createdAt": "2026-10-26",
  "image": { "url": "https://covers.openlibrary.org/b/isbn/9781591845577-M.jpg", "alt": "Couverture du livre Le Personal MBA" },
  "links": [
    { "label": "Acheter le livre", "url": "https://example.com/livre", "commercial": true },
    { "label": "Site de l'auteur", "url": "https://example.org" }
  ]
}
```

- `image` : `{ url, alt }`. L'URL doit être en `https://` (elle est simplement référencée, pas hébergée) et le texte alternatif `alt` est **obligatoire** dès qu'une image est renseignée. Elle illustre le quiz sur l'accueil, dans « Mes quiz » et dans la fiche du quiz ; si l'URL ne se charge plus, une image de remplacement neutre s'affiche.
- `links` : liste ordonnée de `{ label, url, commercial? }`, URL en `https://`. Affichés dans un bloc « Pour aller plus loin » (écrans de résultat et fiche du quiz), ouverts dans un nouvel onglet avec `rel="noopener noreferrer"`. Un lien `"commercial": true` est signalé « lien d'achat ».
- À l'import, une URL qui n'est pas en `https://`, un `alt` manquant ou un libellé vide sont refusés avec un message qui nomme le champ en cause (par exemple `metadata.links[1].url`). Dans l'admin, les deux champs se modifient depuis « Modifier les informations du quiz » (aperçu de l'image, liens ajoutables, retirables et réordonnables).
- Les couvertures et les liens des quiz hébergés sont décrits dans [`src/data/quiz-metadata.json`](src/data/quiz-metadata.json) (appliqués en base par la migration [`041_quiz_covers_and_links.sql`](supabase/041_quiz_covers_and_links.sql)) ; `npm run check-images`, lancé chaque semaine par GitHub Actions, vérifie que ces images et ces liens répondent encore. Privilégier des sources stables : Open Library pour les livres, Wikimedia Commons pour les images du domaine public ; garder les liens sans paramètres de suivi.
- Les images de « Mes quiz » sont lues par `my_quiz_coverage()` : la migration [`032_quiz_coverage_image.sql`](supabase/032_quiz_coverage_image.sql) doit être appliquée à la base.
