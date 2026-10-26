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
- Les images de « Mes quiz » sont lues par `my_quiz_coverage()` : la migration [`032_quiz_coverage_image.sql`](supabase/032_quiz_coverage_image.sql) doit être appliquée à la base.
