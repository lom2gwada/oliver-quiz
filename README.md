# Oliver Quiz

Application web de quiz construite avec React, TypeScript et Vite. Elle permet de s'entraîner sur des questions à choix multiples, du code, du texte libre, du réordonnancement, du vrai/faux, du texte à trous ou de l'association, filtrées par thème et niveau de difficulté.

## Fonctionnalités

- Sept types de questions : QCM, code, texte libre, ordonnancement, vrai/faux, texte à trous et association (`src/components`)
- Filtrage des questions par thème et par difficulté (`src/components/FilterPanel.tsx`)
- Tirage aléatoire d'un nombre de questions choisi par l'utilisateur
- Import d'un quiz personnalisé au format JSON, validé avant utilisation (`src/utils/quizValidation.ts`)
- Un quiz d'exemple est fourni dans [`src/data/sample-quiz.json`](src/data/sample-quiz.json)

## Prérequis

- [Node.js](https://nodejs.org/) 18 ou plus récent

## Installation

```bash
npm install
```

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

## Format d'un quiz JSON

Un fichier de quiz doit respecter le contrat défini dans [`src/types/quiz.ts`](src/types/quiz.ts) et validé par [`parseQuiz`](src/utils/quizValidation.ts). Voir [`src/data/sample-quiz.json`](src/data/sample-quiz.json) pour un exemple complet.
