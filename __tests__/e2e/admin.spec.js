import { expect, test } from './fixtures.js'
import adminPing from '../../api/admin/ping.js'
import { E2E_USERS } from '../../scripts/e2e-fixtures.mjs'

async function emulatorToken(request, user) {
  const response = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo', {
    data: { email: user.email, password: user.password, returnSecureToken: true },
  })
  expect(response.ok()).toBe(true)
  return (await response.json()).idToken
}

async function callAdminPing(token) {
  const result = { status: 0, body: null }
  const response = {
    status(code) {
      result.status = code
      return this
    },
    json(body) {
      result.body = body
      return this
    },
  }
  await adminPing({ headers: { authorization: `Bearer ${token}` } }, response)
  return result
}

test('backend accepts the seeded admin and rejects the caregiver', async ({ request }) => {
  const caregiverToken = await emulatorToken(request, E2E_USERS.caregiver)
  const adminToken = await emulatorToken(request, E2E_USERS.admin)

  await expect(callAdminPing(caregiverToken)).resolves.toMatchObject({ status: 403 })
  await expect(callAdminPing(adminToken)).resolves.toMatchObject({
    status: 200,
    body: { ok: true, uid: E2E_USERS.admin.uid },
  })
})

test('admin custom claim opens the workspace and navigation sections', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: /Pending rooms/ })).toBeVisible()
  await page.getByRole('link', { name: 'Reviewed' }).click()
  await expect(page).toHaveURL(/\/admin\?tab=reviewed$/)
  await expect(page.getByRole('heading', { name: 'Reviewed rooms' })).toBeVisible()
  await page.getByRole('link', { name: 'Support' }).click()
  await expect(page).toHaveURL(/\/admin\?tab=support$/)
  await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible()
})

test('admin accepts a seeded room and sees the persisted review', async ({ page }) => {
  await page.goto('/admin')
  const room = page.getByRole('heading', { name: 'E2E Family Room' })
  await expect(room).toBeVisible()
  const card = room.locator('xpath=ancestor::li[1]')
  await card.getByRole('button', { name: 'Accept' }).click()
  await expect(page.getByText('Room accepted')).toBeVisible()
  await expect(room).toHaveCount(0)

  await page.goto('/admin?tab=reviewed')
  await expect(page.getByRole('heading', { name: 'E2E Family Room' })).toBeVisible()
  await expect(page.getByText(/Accepted .* by you/)).toBeVisible()
})

test('admin can sign out and the protected workspace closes', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: /Avery Admin.*Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Are you sure you want to sign out?' })
  await confirm.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/signin\/admin\/e2e-admin-signin$/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/$/)
})
