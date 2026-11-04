import { expect, test as setup } from './fixtures.js'
import { E2E_USERS } from '../../scripts/e2e-fixtures.mjs'

async function signIn(page, user, destination, storageState) {
  await page.goto('/signin')
  await page.getByLabel('Email address').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${destination.replace('/', '\\/')}(?:\\?.*)?$`), { timeout: 15_000 })
  await page.context().storageState({ path: storageState })
}

setup('authenticate caregiver', async ({ page }) => {
  await signIn(page, E2E_USERS.caregiver, '/care-brief', '__tests__/e2e/.auth/caregiver.json')
})

setup('authenticate parent', async ({ page }) => {
  await signIn(page, E2E_USERS.parent, '/home', '__tests__/e2e/.auth/parent.json')
})

setup('authenticate admin with a custom claim', async ({ page }) => {
  await signIn(page, E2E_USERS.admin, '/admin', '__tests__/e2e/.auth/admin.json')
})
