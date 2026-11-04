import { Buffer } from 'node:buffer'
import { expect, test } from './fixtures.js'
import { expectInsideViewport, expectNoHorizontalOverflow } from './helpers.js'
import { nearestStripe, stripePhoto } from './photo-fixtures.js'

const FIRESTORE = 'http://127.0.0.1:8080/v1/projects/demo-is216/databases/(default)/documents'
const PARENT = 'e2e-parent'
const HOUSEHOLDS = ['e2e-household', 'e2e-household-two']

function photoGroup(page) {
  return page.getByRole('group', { name: 'Profile photo' })
}
function cropDialog(page) {
  return page.getByRole('dialog', { name: 'Adjust your photo' })
}
async function chooseFile(page, file) {
  await page.locator('#pf-photo-input').setInputFiles(file)
}
async function openCropper(page) {
  await chooseFile(page, stripePhoto())
  await expect(cropDialog(page)).toBeVisible()
  // The dialog fades in; wait for it to settle before measuring or pressing keys.
  await expect.poll(() => cropDialog(page).evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
}
async function savePhoto(page) {
  await page.getByRole('button', { name: 'Save photo' }).click()
  await expect(cropDialog(page)).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Photo saved.' })).toBeVisible()
}
// The colours at the left and right edges of the saved square.
async function savedEdges(page) {
  const src = await photoGroup(page).locator('img').getAttribute('src')
  const edges = await page.evaluate(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const at = (x, y) => Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3))
    return { size: image.width, left: at(6, image.width / 2), right: at(image.width - 7, image.width / 2) }
  }, src)
  return { size: edges.size, left: nearestStripe(edges.left), right: nearestStripe(edges.right) }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible()
  await expect(photoGroup(page)).toBeVisible()
  // Tests share one seeded account, so each one starts from "no photo".
  const remove = page.getByRole('button', { name: 'Remove photo' })
  if (await remove.isVisible()) {
    await remove.click()
    await expect(page.getByRole('button', { name: 'Add a photo' })).toBeVisible()
  }
})

test('adding a photo saves a cropped picture that survives a reload and shows in the account menu', async ({ page }) => {
  await expectNoHorizontalOverflow(page)
  await openCropper(page)
  await expectInsideViewport(cropDialog(page), page)
  await expectInsideViewport(page.getByRole('button', { name: 'Save photo' }), page)
  await expectNoHorizontalOverflow(page)
  await savePhoto(page)

  await expect(photoGroup(page).locator('img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  // On a phone the account menu sits inside the closed navigation panel, which role queries skip,
  // so this one is found by its class. It still waits for the real image in the real menu button.
  await expect(page.locator('.um__btn .app-avatar__img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  // Centred crop of a landscape photo: the red stripe on the left edge, the yellow on the right.
  expect(await savedEdges(page)).toEqual({ size: 192, left: 'R', right: 'Y' })

  await page.reload()
  await expect(photoGroup(page).locator('img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible()
})

test('the photo is copied to the member record in every household the account belongs to', async ({ page, request }) => {
  await openCropper(page)
  await savePhoto(page)
  const stored = await photoGroup(page).locator('img').getAttribute('src')
  for (const household of HOUSEHOLDS) {
    // The emulator's owner token reads past the rules, so this checks what was really written.
    const response = await request.get(`${FIRESTORE}/households/${household}/members/${PARENT}`, { headers: { Authorization: 'Bearer owner' } })
    expect(response.ok()).toBe(true)
    expect((await response.json()).fields.photoURL.stringValue).toBe(stored)
  }
  const profile = await request.get(`${FIRESTORE}/users/${PARENT}`, { headers: { Authorization: 'Bearer owner' } })
  expect((await profile.json()).fields.photoURL.stringValue).toBe(stored)
})

test('moving the photo with the keyboard changes which part is saved', async ({ page }) => {
  await openCropper(page)
  await page.getByRole('group', { name: /Photo crop area/ }).focus()
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowRight')
  await savePhoto(page)
  expect(await savedEdges(page)).toEqual({ size: 192, left: 'R', right: 'B' })

  await openCropper(page)
  await page.getByRole('group', { name: /Photo crop area/ }).focus()
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowLeft')
  await savePhoto(page)
  expect(await savedEdges(page)).toEqual({ size: 192, left: 'G', right: 'Y' })
})

test('zooming in to the maximum keeps the middle of the photo', async ({ page }) => {
  await openCropper(page)
  const zoom = page.getByRole('slider', { name: 'Zoom' })
  await zoom.fill('4')
  await expect(zoom).toHaveAttribute('aria-valuetext', '400%')
  await savePhoto(page)
  expect(await savedEdges(page)).toEqual({ size: 192, left: 'G', right: 'B' })
})

test('Escape, Cancel and a click outside all close the dialog without saving', async ({ page }) => {
  await openCropper(page)
  await page.keyboard.press('Escape')
  await expect(cropDialog(page)).toBeHidden()

  await openCropper(page)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(cropDialog(page)).toBeHidden()

  await openCropper(page)
  await page.mouse.click(2, 2)
  await expect(cropDialog(page)).toBeHidden()

  await expect(photoGroup(page).locator('img')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add a photo' })).toBeVisible()
})

test('files that are not usable photos are refused with a clear message', async ({ page }) => {
  const error = photoGroup(page).getByRole('alert')
  await chooseFile(page, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') })
  await expect(error).toContainText('image file')
  await chooseFile(page, { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('definitely not a png') })
  await expect(error).toContainText('could not be read')
  await expect(cropDialog(page)).toBeHidden()
  await expect(photoGroup(page).locator('img')).toHaveCount(0)
})

test('removing the photo brings back the initials and stays removed after a reload', async ({ page }) => {
  await openCropper(page)
  await savePhoto(page)
  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Photo removed.' })).toBeVisible()
  await expect(photoGroup(page).locator('img')).toHaveCount(0)
  await expect(photoGroup(page).locator('.app-avatar')).toHaveText(/^[A-Z?]{1,2}$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Add a photo' })).toBeVisible()
  await expect(photoGroup(page).locator('img')).toHaveCount(0)
})

test('the open dialog stays on screen when the device is rotated', async ({ page }) => {
  await openCropper(page)
  const { width, height } = page.viewportSize()
  await page.setViewportSize({ width: height, height: width })
  await expectInsideViewport(cropDialog(page), page)
  await expectInsideViewport(page.getByRole('button', { name: 'Save photo' }), page)
  await expectInsideViewport(page.getByRole('button', { name: 'Cancel' }), page)
  await expectNoHorizontalOverflow(page)
})
