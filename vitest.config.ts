import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Config mínima: as funções que testamos são puras (aritmética de datas sobre
// strings), então não precisam de jsdom nem de mock de Supabase. O alias '@'
// existe porque patrimonio-pagamentos.ts importa '@/lib/utils'.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
})
