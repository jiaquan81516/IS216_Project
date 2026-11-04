import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

const authDir = '__tests__/e2e/.auth'
Object.assign(process.env, {
  E2E_EMULATORS: 'true',
  GCLOUD_PROJECT: 'demo-is216',
  FIREBASE_PROJECT_ID: 'demo-is216',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  ADMIN_UID: 'e2e-admin',
})

export default defineConfig({
  testDir: './__tests__/e2e',
  testMatch: '**/*.spec.js',
  globalSetup: './scripts/e2e-global-setup.mjs',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [
    { name: 'auth-setup', testMatch: /auth\.setup\.js/ },
    { name: 'public-chromium', testMatch: /public-smoke\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
    { name: 'public-firefox', testMatch: /public-smoke\.spec\.js/, use: { ...devices['Desktop Firefox'] } },
    { name: 'public-webkit', testMatch: /public-smoke\.spec\.js/, use: { ...devices['Desktop Safari'] } },
    { name: 'public-mobile-chrome', testMatch: /public-smoke\.spec\.js/, use: { ...devices['Pixel 5'] } },
    { name: 'public-mobile-safari', testMatch: /public-smoke\.spec\.js/, use: { ...devices['iPhone 12'] } },
    {
      name: 'caregiver-desktop',
      testMatch: /caregiver\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'], storageState: `${authDir}/caregiver.json` },
    },
    {
      name: 'caregiver-tablet',
      testMatch: /caregiver-responsive\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true, storageState: `${authDir}/caregiver.json` },
    },
    {
      name: 'caregiver-mobile',
      testMatch: /caregiver-responsive\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['iPhone 12'], storageState: `${authDir}/caregiver.json` },
    },
    {
      name: 'parent-desktop',
      testMatch: /calendar\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'], storageState: `${authDir}/parent.json` },
    },
    {
      name: 'parent-mobile',
      testMatch: /calendar-responsive\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['iPhone 12'], storageState: `${authDir}/parent.json` },
    },
    {
      name: 'admin-desktop',
      testMatch: /admin\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'], storageState: `${authDir}/admin.json` },
    },
    {
      name: 'admin-mobile',
      testMatch: /admin-responsive\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['iPhone 12'], storageState: `${authDir}/admin.json` },
    },
  ],
  webServer: [
    {
      command: 'pnpm e2e:emulators',
      url: 'http://127.0.0.1:4400',
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm dev:e2e',
      url: 'http://127.0.0.1:4173',
      timeout: 75_000,
      reuseExistingServer: false,
    },
  ],
})
