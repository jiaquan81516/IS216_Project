import { fileURLToPath, URL } from 'node:url'

import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { roomLocationDev } from './scripts/room-location-dev.mjs'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && mode === 'production' && env.VITE_E2E_EMULATORS === 'true') {
    throw new Error('Refusing a production build with Firebase E2E emulators enabled.')
  }
  return {
    plugins: [
      roomLocationDev(),
      vue(),
      vueJsx(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
