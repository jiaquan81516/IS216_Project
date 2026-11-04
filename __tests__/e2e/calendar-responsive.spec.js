import { expect, test } from './fixtures.js'
import { expectInsideViewport, expectNoHorizontalOverflow } from './helpers.js'

test('mobile calendar menu, active state and event dialog are positioned safely', async ({ page }) => {
  await page.goto('/calendar')
  await expectNoHorizontalOverflow(page)

  const view = page.getByRole('button', { name: 'Calendar view: Month' })
  await view.tap()
  const menu = page.getByRole('menu', { name: 'Calendar view' })
  await expectInsideViewport(menu, page)
  await expect(page.getByRole('menuitemradio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: 'Day' }).tap()
  await expect(page.getByRole('button', { name: 'Calendar view: Day' })).toBeVisible()

  await page.getByRole('button', { name: 'Create event' }).tap()
  await expectInsideViewport(page.getByRole('dialog'), page)
  await expect(page.getByRole('heading', { name: 'Add an event' })).toBeVisible()
})

test('open calendar view menu remains contained after rotation', async ({ page }) => {
  await page.goto('/calendar')
  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: 'Calendar view: Month' }).tap()
  await expectInsideViewport(page.getByRole('menu', { name: 'Calendar view' }), page)
  await expectInsideViewport(page.getByRole('button', { name: 'Today' }), page)
  await expectNoHorizontalOverflow(page)
})
