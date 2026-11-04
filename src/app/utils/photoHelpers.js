// Helpers for profile photos: checking the chosen file, the crop maths, and a safety check on
// what is stored. The file and canvas work lives in PhotoCropDialog; the maths here is plain
// numbers, so it can be tested without a browser.

// The saved picture is a square this many pixels wide. 192 stays sharp on a 2x screen at the
// largest size we show (96px) and makes a JPEG of roughly 10 to 25 KB.
export const PHOTO_SIZE = 192;
export const PHOTO_QUALITY = 0.82;
export const PHOTO_MAX_FILE_BYTES = 10 * 1024 * 1024;
// Characters in the stored data URL. firestore.rules caps the same field at the same number.
export const PHOTO_MAX_URL_LENGTH = 60000;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

const JPEG_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

export function validatePhotoFile(file) {
  if (!file) return { ok: false, message: "Choose a photo to continue." };
  const type = String(file.type || "").toLowerCase();
  if (!type.startsWith("image/") || type.includes("svg")) {
    return { ok: false, message: "Choose an image file, such as a JPG or PNG." };
  }
  if (!file.size) return { ok: false, message: "That file is empty. Choose another photo." };
  if (file.size > PHOTO_MAX_FILE_BYTES) {
    return { ok: false, message: "That photo is over 10 MB. Choose a smaller one." };
  }
  return { ok: true, message: "" };
}

// What may be shown in an avatar: the small JPEG this app saves, or a plain https picture
// (a Google account photo). Anything else, including other data URLs, is ignored.
export function isSafePhotoUrl(value) {
  if (typeof value !== "string" || !value) return false;
  if (value.startsWith("data:")) return value.length <= PHOTO_MAX_URL_LENGTH && JPEG_DATA_URL.test(value);
  return value.length <= 2048 && /^https:\/\/[^\s]+$/i.test(value);
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function clampZoom(zoom) {
  const number = Number(zoom);
  return Number.isFinite(number) ? clamp(number, ZOOM_MIN, ZOOM_MAX) : ZOOM_MIN;
}

// The crop is described by three numbers that do not depend on how big the box is on screen,
// so a rotated phone or a resized window keeps the same crop:
//   zoom  1 shows the whole short side of the photo in the box, 4 shows a quarter of it.
//   u, v  how far the photo has been moved from centred, in box widths. Positive moves it
//         right and down, so the box looks at the left and top of the photo.
function assertSize(natW, natH) {
  if (!(natW > 0) || !(natH > 0)) throw new RangeError("The photo has no size.");
}

// The furthest the photo can move before an edge of the box would show empty space.
export function maxOffset({ natW, natH, zoom }) {
  assertSize(natW, natH);
  const short = Math.min(natW, natH);
  return {
    x: Math.max(0, (natW * zoom) / (2 * short) - 0.5),
    y: Math.max(0, (natH * zoom) / (2 * short) - 0.5),
  };
}

export function clampCrop({ natW, natH, zoom, u = 0, v = 0 }) {
  const z = clampZoom(zoom);
  const max = maxOffset({ natW, natH, zoom: z });
  // "+ 0" turns a negative zero into a plain zero when a photo has no room to move that way.
  return { zoom: z, u: clamp(Number(u) || 0, -max.x, max.x) + 0, v: clamp(Number(v) || 0, -max.y, max.y) + 0 };
}

// The square of the original photo, in its own pixels, that the box is looking at.
export function cropSource({ natW, natH, zoom, u = 0, v = 0 }) {
  assertSize(natW, natH);
  const crop = clampCrop({ natW, natH, zoom, u, v });
  const short = Math.min(natW, natH);
  return {
    sx: natW / 2 - (short * (0.5 + crop.u)) / crop.zoom,
    sy: natH / 2 - (short * (0.5 + crop.v)) / crop.zoom,
    size: short / crop.zoom,
  };
}

// Cuts the chosen square out of the loaded image and returns it as a small JPEG data URL.
// A white background shows through any transparent PNG pixels.
export function renderCrop(image, crop, { size = PHOTO_SIZE, quality = PHOTO_QUALITY, createCanvas } = {}) {
  const natW = image.naturalWidth || image.width;
  const natH = image.naturalHeight || image.height;
  const source = cropSource({ natW, natH, ...crop });
  const canvas = createCanvas ? createCanvas() : document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare photos.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, source.sx, source.sy, source.size, source.size, 0, 0, size, size);
  const url = canvas.toDataURL("image/jpeg", quality);
  if (!isSafePhotoUrl(url)) throw new Error("The photo could not be prepared. Try a different one.");
  return url;
}
