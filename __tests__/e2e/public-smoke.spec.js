import { expect, test } from './fixtures.js'

const publicPages = [
  { path: '/', heading: 'Share the care. Share the load.' },
  { path: '/start', heading: 'Where are you in the journey?' },
  { path: '/role', heading: 'Who will use NurtureTrack?' },
  { path: '/account', heading: 'Create your account' },
  { path: '/signin', heading: 'Sign in' },
]

const protectedPages = [
  '/home',
  '/care-log',
  '/checklist',
  '/rota',
  '/wellness',
  '/support',
  '/support/rooms',
  '/support/kids-care',
  '/calendar',
  '/settings',
  '/profile',
  '/care-brief',
  '/care-brief/duty',
]

const viewportWidths = [320, 375, 390, 768, 1024, 1280, 1440]

test.describe('public pages', () => {
  for (const { path, heading } of publicPages) {
    test(`${path} renders its primary content`, async ({ page }) => {
      await page.goto(path)

      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`))
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    })
  }

  test('landing page exposes the two primary journeys', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Create your household' })).toHaveAttribute('href', '/start')
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
    await expect(page.getByRole('heading', { name: 'More than a care tracker' })).toBeVisible()
  })

  test('onboarding moves through journey, role, account and household setup without creating data', async ({ page }) => {
    await page.goto('/start')

    await page.getByText('Preparing for baby', { exact: true }).click()
    await expect(page).toHaveURL(/\/role$/)

    await page.getByText('Parent', { exact: true }).click()
    await expect(page).toHaveURL(/\/account$/)

    await page.getByLabel('Your name').fill('Browser Test Parent')
    await page.getByLabel('Email address').fill('browser-test@example.invalid')
    await page.getByLabel('Create a password').fill('not-a-real-password')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page).toHaveURL(/\/household$/)
    await expect(page.getByRole('radiogroup', { name: 'Household setup' })).toBeVisible()
  })

  test('invitation code is retained through the public onboarding links', async ({ page }) => {
    await page.goto('/join/TEST-CODE')

    await expect(page).toHaveURL(/\/signin\?code=TEST-CODE$/)
    await page.getByRole('link', { name: 'Create your household' }).click()
    await expect(page).toHaveURL(/\/start\?code=TEST-CODE$/)

    await page.getByText('Caring for a newborn', { exact: true }).click()
    await expect(page).toHaveURL(/\/role\?code=TEST-CODE$/)
    await page.getByText('Caregiver', { exact: true }).click()
    await expect(page).toHaveURL(/\/account\?code=TEST-CODE$/)
  })

  test('account form reports all client-side validation errors', async ({ page }) => {
    await page.goto('/account')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    await expect(page.getByText('Enter your name.')).toBeVisible()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
    await expect(page).toHaveURL(/\/account$/)
  })

  test('sign-in form reports email and password validation errors', async ({ page }) => {
    await page.goto('/signin')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Enter your password.')).toBeVisible()
    await expect(page).toHaveURL(/\/signin$/)
  })
})

test.describe('route protection', () => {
  for (const path of protectedPages) {
    test(`${path} sends a signed-out visitor to sign in`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/signin$/)
      await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
    })
  }

  test('admin and unknown routes do not expose private content', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/this-route-does-not-exist')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Share the care. Share the load.' })).toBeVisible()
  })
})

test.describe('responsive public layouts', () => {
  for (const width of viewportWidths) {
    test(`public pages do not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })

      for (const { path, heading } of publicPages) {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 10_000 })
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      }
    })
  }
})

test.describe('mobile device interactions', () => {
  test.beforeEach(async ({ isMobile }) => {
    test.skip(!isMobile, 'Runs only in the touch-capable mobile projects')
  })

  test('touch navigation keeps onboarding controls usable in portrait', async ({ page }) => {
    await page.goto('/start')

    await page.getByText('Preparing for baby', { exact: true }).tap()
    await expect(page).toHaveURL(/\/role$/)
    await page.getByText('Parent', { exact: true }).tap()
    await expect(page).toHaveURL(/\/account$/)

    for (const control of [
      page.getByLabel('Your name'),
      page.getByLabel('Email address'),
      page.getByLabel('Create a password'),
      page.getByRole('button', { name: 'Continue', exact: true }),
    ]) {
      await control.scrollIntoViewIfNeeded()
      await expect(control).toBeVisible()
      const box = await control.boundingBox()
      const viewport = page.viewportSize()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    }
  })

  test('validation messages remain readable and do not collapse on mobile', async ({ page }) => {
    await page.goto('/account')
    await page.getByRole('button', { name: 'Continue', exact: true }).tap()

    for (const message of [
      'Enter your name.',
      'Enter a valid email address.',
      'Use at least 8 characters.',
    ]) {
      const error = page.getByText(message)
      await error.scrollIntoViewIfNeeded()
      await expect(error).toBeVisible()
      const box = await error.boundingBox()
      expect(box.width).toBeGreaterThan(120)
      expect(box.height).toBeLessThan(80)
    }

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)
  })

  test('primary actions stay visible and separated in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/')

    const create = page.getByRole('link', { name: 'Create your household' })
    const signIn = page.getByRole('link', { name: 'Sign in' })
    await create.scrollIntoViewIfNeeded()
    await expect(create).toBeVisible()
    await expect(signIn).toBeVisible()

    const createBox = await create.boundingBox()
    const signInBox = await signIn.boundingBox()
    const separated =
      createBox.x + createBox.width <= signInBox.x ||
      signInBox.x + signInBox.width <= createBox.x ||
      createBox.y + createBox.height <= signInBox.y ||
      signInBox.y + signInBox.height <= createBox.y
    expect(separated).toBe(true)
    for (const box of [createBox, signInBox]) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(845)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(844)
  })
})
