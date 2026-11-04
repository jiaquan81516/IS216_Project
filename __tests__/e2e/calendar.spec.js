import { expect, test } from './fixtures.js'

test('calendar Day Week Month controls expose active state and date navigation', async ({ page }) => {
  await page.goto('/calendar')
  const view = page.getByRole('button', { name: 'Calendar view: Month' })
  await expect(view).toBeVisible()
  const initialLabel = await page.locator('#cal-month').textContent()

  await view.click()
  await page.getByRole('menuitemradio', { name: 'Day' }).click()
  await expect(page.getByRole('button', { name: 'Calendar view: Day' })).toBeVisible()
  await page.getByRole('button', { name: 'Calendar view: Day' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'Day' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: 'Week' }).click()
  await expect(page.getByRole('button', { name: 'Calendar view: Week' })).toBeVisible()
  await page.getByRole('button', { name: 'Calendar view: Week' }).click()
  await page.getByRole('menuitemradio', { name: 'Month' }).click()
  await expect(page.getByRole('button', { name: 'Calendar view: Month' })).toBeVisible()

  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(page.locator('#cal-month')).not.toHaveText(initialLabel)
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.locator('#cal-month')).toHaveText(initialLabel)
})

test('seeded calendar event opens with its persisted details', async ({ page }) => {
  await page.goto('/calendar')
  const event = page.getByRole('button', { name: /Paediatric appointment/ }).first()
  await expect(event).toBeVisible()
  await event.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Paediatric appointment')).toBeVisible()
  await expect(dialog.getByText('Bring the health booklet.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Edit Paediatric appointment' })).toBeVisible()
})
