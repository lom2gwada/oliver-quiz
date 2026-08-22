import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/oliver-quiz/',
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/utils/quizValidation.ts', 'src/utils/shuffle.ts', 'src/utils/time.ts', 'src/utils/sound.ts', 'src/components/ResultPage.tsx'],
    },
  },
})
