import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/oliver-quiz/',
  // Code commun avec Quiz Caraïbes et Periodic Quiz : sous-module git `engine/` (dépôt quiz-engine).
  // `@engine/...` = ses sources.
  resolve: {
    alias: [{ find: /^@engine\//, replacement: fileURLToPath(new URL('./engine/src/', import.meta.url)) }],
  },
  test: {
    environment: 'node',
    // Les tests du moteur (engine/src) tournent dans Quiz Caraïbes et Periodic Quiz, avec leur setup.
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/quizValidation.ts', 'src/utils/shuffle.ts', 'engine/src/utils/time.ts', 'engine/src/utils/sound.ts', 'src/components/ResultPage.tsx'],
    },
  },
})
