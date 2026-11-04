import { expect, test } from './fixtures.js'

test('caregiver navigates permitted views and switches babies', async ({ page }) => {
  await page.goto('/care-brief')
  await expect(page.getByRole('heading', { name: 'Today’s care brief' })).toBeVisible()

  const babies = page.getByRole('group', { name: 'Select baby' })
  await expect(babies.getByRole('button', { name: 'Milo' })).toHaveAttribute('aria-pressed', 'true')
  await babies.getByRole('button', { name: 'Zoe' }).click()
  await expect(babies.getByRole('button', { name: 'Zoe' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('A quick guide for caring for Zoe.')).toBeVisible()

  await page.getByRole('link', { name: 'Duty' }).click()
  await expect(page).toHaveURL(/\/care-brief\/duty$/)
  await expect(page.getByRole('heading', { name: 'Duty', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Care brief' }).click()
  await expect(page).toHaveURL(/\/care-brief$/)
})

test('caregiver creates and edits a care log which persists after reload', async ({ page }) => {
  await page.goto('/care-brief')
  await page.getByRole('button', { name: 'Add a care log' }).click()
  const dialog = page.getByRole('dialog', { name: 'Log care' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('radio', { name: 'Note' }).click()
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await dialog.getByLabel('Note').fill('E2E caregiver note')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('E2E caregiver note')).toBeVisible()

  await page.reload()
  await expect(page.getByText('E2E caregiver note')).toBeVisible()
  await page.getByRole('button', { name: 'Edit note log' }).first().click()
  const edit = page.getByRole('dialog', { name: 'Edit note' })
  await edit.getByLabel('Note').fill('E2E caregiver note edited')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByText('E2E caregiver note edited')).toBeVisible()
  await page.reload()
  await expect(page.getByText('E2E caregiver note edited')).toBeVisible()
})

test('caregiver is denied admin UI and admin-only Firestore writes', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Share the care. Share the load.' })).toBeVisible()

  await page.goto('/care-brief')
  const result = await page.evaluate(async () => {
    try {
      const [{ saveSupportList }, { auth }] = await Promise.all([
        import('/src/api/supportContent.js'),
        import('/src/api/firebase.js'),
      ])
      await saveSupportList(auth.currentUser.uid, 'guides', [])
      return { allowed: true }
    } catch (error) {
      return { allowed: false, code: error?.code || '' }
    }
  })
  expect(result).toEqual({ allowed: false, code: 'permission-denied' })
})

test('caregiver can sign out through the confirmation dialog', async ({ page }) => {
  await page.goto('/care-brief')
  await page.getByRole('button', { name: /Casey Caregiver.*Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Are you sure you want to sign out?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
})
