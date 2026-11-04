import { test as base, expect } from '@playwright/test'

// Firebase Auth loads Google's hosted iframe script (apis.google.com/js/api.js) as soon as the app
// starts. The emulators never need it, and when that request stalls the page's `load` event never
// fires, so `page.goto` times out while the app sits on its loading screen. Fail it immediately.
// Fonts are left alone so layout (overflow) checks still run against the real typefaces.
const GOOGLE_HOSTED_SCRIPTS = /^https:\/\/apis\.google\.com\//

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(GOOGLE_HOSTED_SCRIPTS, (route) => route.abort())
    await use(context)
  },
})

export { expect }
