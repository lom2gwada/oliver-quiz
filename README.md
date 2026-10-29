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
