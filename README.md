# Quiz technique

Application web de quiz technique construite avec React, TypeScript et Vite. Elle permet de s'entraîner sur des questions à choix multiples, du code, du texte libre ou du réordonnancement, filtrées par thème et niveau de difficulté.

## Fonctionnalités

- Quatre types de questions : QCM, code, texte libre et ordonnancement (`src/components`)
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

## Scripts disponibles

| Commande          | Description                                      |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Démarre le serveur de développement Vite           |
| `npm run build`   | Vérifie les types puis génère le build de production |
| `npm run preview` | Prévisualise le build de production en local       |

## Format d'un quiz JSON

Un fichier de quiz doit respecter le contrat défini dans [`src/types/quiz.ts`](src/types/quiz.ts) et validé par [`parseQuiz`](src/utils/quizValidation.ts). Voir [`src/data/sample-quiz.json`](src/data/sample-quiz.json) pour un exemple complet.
