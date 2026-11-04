import { expect, test } from './fixtures.js'
import { expectInsideViewport, expectNoHorizontalOverflow, closeNavMenu } from './helpers.js'

test('admin mobile navigation and account menu stay within the viewport', async ({ page }) => {
  await page.goto('/admin')
  await expectNoHorizontalOverflow(page)

  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  await menu.tap()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await expectInsideViewport(page.getByRole('link', { name: 'Reviewed' }), page)
  await page.getByRole('button', { name: /Avery Admin.*Account menu/ }).tap()
  await expectInsideViewport(page.getByRole('menu', { name: 'Account' }), page)
  await closeNavMenu(page)
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
})

test('admin menu remains usable after landscape rotation', async ({ page }) => {
  await page.goto('/admin')
  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: 'Menu' }).tap()
  await expectInsideViewport(page.getByRole('link', { name: 'Pending' }), page)
  await expectInsideViewport(page.getByRole('link', { name: 'Support' }), page)
  await expectNoHorizontalOverflow(page)
})
