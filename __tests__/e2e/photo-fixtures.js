import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'

// Builds a small PNG in memory, so the photo tests need no image files in the repository.
// The picture is four vertical stripes (red, green, blue, yellow), which makes the saved crop
// easy to check: the colours at the left and right edges say which part of the photo was kept.
export const STRIPE_COLORS = Object.freeze({
  R: [220, 40, 40],
  G: [40, 170, 60],
  B: [40, 80, 220],
  Y: [240, 200, 30],
})

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

export function stripePng(width = 800, height = 600) {
  const palette = Object.values(STRIPE_COLORS)
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x += 1) {
    const [r, g, b] = palette[Math.min(3, Math.floor((x / width) * 4))]
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export function stripePhoto(name = 'stripes.png') {
  return { name, mimeType: 'image/png', buffer: stripePng() }
}

// The stripe a pixel is closest to, as 'R', 'G', 'B' or 'Y'.
export function nearestStripe([r, g, b]) {
  const distance = (c) => Math.hypot(c[0] - r, c[1] - g, c[2] - b)
  return Object.entries(STRIPE_COLORS).sort((a, c) => distance(a[1]) - distance(c[1]))[0][0]
}
