import { describe, expect, it, vi } from "vitest";
import {
  clampCrop,
  clampZoom,
  cropSource,
  isSafePhotoUrl,
  maxOffset,
  PHOTO_MAX_FILE_BYTES,
  PHOTO_MAX_URL_LENGTH,
  PHOTO_QUALITY,
  PHOTO_SIZE,
  renderCrop,
  validatePhotoFile,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@/app/utils/photoHelpers";

const jpeg = (length = 40) => `data:image/jpeg;base64,${"A".repeat(length)}`;

describe("validatePhotoFile", () => {
  it("accepts ordinary photos", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(validatePhotoFile({ type, size: 2_000_000 })).toEqual({ ok: true, message: "" });
    }
  });
  it("asks for a file when there is none", () => {
    expect(validatePhotoFile(null).ok).toBe(false);
  });
  it.each([
    ["a PDF", { type: "application/pdf", size: 1000 }],
    ["a file with no type", { type: "", size: 1000 }],
    ["an SVG, which can carry scripts", { type: "image/svg+xml", size: 1000 }],
  ])("rejects %s", (_label, file) => {
    const result = validatePhotoFile(file);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/image file/);
  });
  it("rejects empty and oversized files, and allows exactly the limit", () => {
    expect(validatePhotoFile({ type: "image/png", size: 0 }).message).toMatch(/empty/);
    expect(validatePhotoFile({ type: "image/png", size: PHOTO_MAX_FILE_BYTES + 1 }).message).toMatch(/10 MB/);
    expect(validatePhotoFile({ type: "image/png", size: PHOTO_MAX_FILE_BYTES }).ok).toBe(true);
  });
});

describe("isSafePhotoUrl", () => {
  it("accepts the JPEG this app saves and an https picture", () => {
    expect(isSafePhotoUrl(jpeg())).toBe(true);
    expect(isSafePhotoUrl("https://lh3.googleusercontent.com/a/photo=s96-c")).toBe(true);
  });
  it.each([
    ["nothing", ""],
    ["null", null],
    ["a number", 5],
    ["a script", "javascript:alert(1)"],
    ["plain http", "http://example.com/a.jpg"],
    ["a PNG data URL", "data:image/png;base64,AAAA"],
    ["an SVG data URL", "data:image/svg+xml;base64,AAAA"],
    ["a JPEG with a stray character", "data:image/jpeg;base64,AA AA"],
    ["an https URL with a space", "https://example.com/a b.jpg"],
  ])("rejects %s", (_label, value) => {
    expect(isSafePhotoUrl(value)).toBe(false);
  });
  it("rejects data URLs over the stored limit, and allows exactly the limit", () => {
    const prefix = "data:image/jpeg;base64,".length;
    expect(isSafePhotoUrl(jpeg(PHOTO_MAX_URL_LENGTH - prefix))).toBe(true);
    expect(isSafePhotoUrl(jpeg(PHOTO_MAX_URL_LENGTH - prefix + 1))).toBe(false);
  });
});

describe("crop maths", () => {
  const landscape = { natW: 800, natH: 600 };
  const portrait = { natW: 600, natH: 800 };

  it("keeps zoom between the limits and ignores nonsense", () => {
    expect(clampZoom(0.2)).toBe(ZOOM_MIN);
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom("abc")).toBe(ZOOM_MIN);
    expect(clampZoom(NaN)).toBe(ZOOM_MIN);
  });

  it("starts centred on the middle square of a landscape photo", () => {
    expect(cropSource({ ...landscape, zoom: 1 })).toEqual({ sx: 100, sy: 0, size: 600 });
  });
  it("starts centred on the middle square of a portrait photo", () => {
    expect(cropSource({ ...portrait, zoom: 1 })).toEqual({ sx: 0, sy: 100, size: 600 });
  });
  it("zooming in shows a smaller square around the same centre", () => {
    expect(cropSource({ ...landscape, zoom: 2 })).toEqual({ sx: 250, sy: 150, size: 300 });
    expect(cropSource({ ...landscape, zoom: 4 })).toEqual({ sx: 325, sy: 225, size: 150 });
  });
  it("a square photo cannot move at zoom 1 but can once zoomed", () => {
    expect(maxOffset({ natW: 500, natH: 500, zoom: 1 })).toEqual({ x: 0, y: 0 });
    expect(maxOffset({ natW: 500, natH: 500, zoom: 2 })).toEqual({ x: 0.5, y: 0.5 });
  });
  it("lets a landscape photo slide sideways to its edges and no further", () => {
    expect(maxOffset({ ...landscape, zoom: 1 }).x).toBeCloseTo(1 / 6, 10);
    expect(maxOffset({ ...landscape, zoom: 1 }).y).toBe(0);
    // Dragged right as far as it goes, the box looks at the left end of the photo.
    expect(cropSource({ ...landscape, zoom: 1, u: 5 })).toEqual({ sx: 0, sy: 0, size: 600 });
    // Dragged left as far as it goes, it looks at the right end.
    const farLeft = cropSource({ ...landscape, zoom: 1, u: -5 });
    expect(farLeft.sx).toBeCloseTo(200, 8);
    expect(farLeft.sx + farLeft.size).toBeCloseTo(800, 8);
    // Vertical movement is locked while the photo exactly fills the box that way.
    expect(cropSource({ ...landscape, zoom: 1, v: 3 }).sy).toBe(0);
  });
  it("pulls the position back in when zooming out after a move", () => {
    const zoomedIn = clampCrop({ ...landscape, zoom: 3, u: 0.9, v: -0.9 });
    expect(zoomedIn.u).toBeCloseTo(0.9, 10);
    const zoomedOut = clampCrop({ ...landscape, zoom: 1, u: zoomedIn.u, v: zoomedIn.v });
    expect(zoomedOut.u).toBeCloseTo(1 / 6, 10);
    expect(zoomedOut.v).toBe(0);
  });
  it("never looks outside the photo, for any zoom and position", () => {
    for (const dims of [landscape, portrait, { natW: 500, natH: 500 }, { natW: 4000, natH: 1000 }, { natW: 64, natH: 4000 }]) {
      for (let zoom = 0.5; zoom <= 6; zoom += 0.37) {
        for (const u of [-9, -0.4, 0, 0.2, 9]) {
          for (const v of [-9, -0.1, 0, 0.3, 9]) {
            const { sx, sy, size } = cropSource({ ...dims, zoom, u, v });
            expect(sx).toBeGreaterThanOrEqual(-1e-9);
            expect(sy).toBeGreaterThanOrEqual(-1e-9);
            expect(sx + size).toBeLessThanOrEqual(dims.natW + 1e-9);
            expect(sy + size).toBeLessThanOrEqual(dims.natH + 1e-9);
          }
        }
      }
    }
  });
  it("treats a missing or invalid position as centred", () => {
    expect(cropSource({ ...landscape, zoom: 1, u: "x", v: undefined })).toEqual({ sx: 100, sy: 0, size: 600 });
  });
  it("refuses a photo with no size", () => {
    expect(() => cropSource({ natW: 0, natH: 100, zoom: 1 })).toThrow(RangeError);
    expect(() => maxOffset({ natW: 100, natH: 0, zoom: 1 })).toThrow(RangeError);
  });
});

describe("renderCrop", () => {
  function fakeCanvas(url = jpeg()) {
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "", imageSmoothingQuality: "" };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toDataURL: vi.fn(() => url) };
    return { canvas, context };
  }
  const image = { naturalWidth: 800, naturalHeight: 600 };

  it("draws the chosen square onto a white square canvas and returns a JPEG", () => {
    const { canvas, context } = fakeCanvas();
    const url = renderCrop(image, { zoom: 2, u: 0, v: 0 }, { createCanvas: () => canvas });
    expect(canvas.width).toBe(PHOTO_SIZE);
    expect(canvas.height).toBe(PHOTO_SIZE);
    expect(context.fillStyle).toBe("#ffffff");
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    expect(context.drawImage).toHaveBeenCalledWith(image, 250, 150, 300, 300, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", PHOTO_QUALITY);
    expect(url).toBe(jpeg());
  });
  it("fails clearly when the browser gives no canvas context", () => {
    const { canvas } = fakeCanvas();
    canvas.getContext.mockReturnValue(null);
    expect(() => renderCrop(image, { zoom: 1 }, { createCanvas: () => canvas })).toThrow(/cannot prepare/);
  });
  it("fails when the result is not a safe, small JPEG", () => {
    const { canvas } = fakeCanvas("data:image/png;base64,AAAA");
    expect(() => renderCrop(image, { zoom: 1 }, { createCanvas: () => canvas })).toThrow(/could not be prepared/);
  });
});
