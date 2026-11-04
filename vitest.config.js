import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['__tests__/**/*.spec.js'],
      exclude: [...configDefaults.exclude, '__tests__/e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
