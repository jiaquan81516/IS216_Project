import { expect } from '@playwright/test'

export async function expectInsideViewport(locator, page) {
  await locator.scrollIntoViewIfNeeded()
  await expect(locator).toBeVisible()
  const viewport = page.viewportSize()
  await expect.poll(async () => {
    const box = await locator.boundingBox()
    if (!box) return false
    return box.x >= -1 &&
      box.y >= -1 &&
      box.x + box.width <= viewport.width + 1 &&
      box.y + box.height <= viewport.height + 1
  }).toBe(true)
  return locator.boundingBox()
}

// Closes the open navigation menu the way a person would at this width. Below 576px the panel is
// full width and covers the whole dimmed layer, so the Menu button is the only way out. Wider, the
// panel leaves a dimmed strip beside it, which is what a person taps. Playwright's default tap
// lands on the centre of the layer, which is the panel, so aim at the strip.
export async function closeNavMenu(page) {
  if (page.viewportSize().width < 576) {
    await page.getByRole('button', { name: 'Menu', exact: true }).tap()
    return
  }
  await page.getByRole('button', { name: 'Close navigation menu' }).tap({ position: { x: 8, y: 300 } })
}

export async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width)
}
