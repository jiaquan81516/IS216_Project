import { expect, test } from './fixtures.js'
import { expectInsideViewport, expectNoHorizontalOverflow, closeNavMenu } from './helpers.js'

test('mobile caregiver menu, baby switcher and care-log dialog remain usable', async ({ page }) => {
  await page.goto('/care-brief')
  await expectNoHorizontalOverflow(page)

  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  await menu.tap()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await expectInsideViewport(page.getByRole('link', { name: 'Duty' }), page)
  await closeNavMenu(page)
  await expect(menu).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('group', { name: 'Select baby' }).getByRole('button', { name: 'Zoe' }).tap()
  await expect(page.getByText('A quick guide for caring for Zoe.')).toBeVisible()
  await page.getByRole('button', { name: 'Add a care log' }).tap()
  await expectInsideViewport(page.getByRole('dialog', { name: 'Log care' }), page)
  await expectNoHorizontalOverflow(page)
})

test('open caregiver dialog remains contained after rotation', async ({ page }) => {
  await page.goto('/care-brief')
  await page.getByRole('button', { name: 'Add a care log' }).tap()
  const dialog = page.getByRole('dialog', { name: 'Log care' })
  await expect(dialog).toBeVisible()

  await page.setViewportSize({ width: 844, height: 390 })
  await expectInsideViewport(dialog, page)
  await expectNoHorizontalOverflow(page)
})
