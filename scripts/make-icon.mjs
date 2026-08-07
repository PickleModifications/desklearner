/**
 * Generates build/icon.png (and a .ico) from a small procedural design, so the
 * repository does not need a committed binary asset.
 *
 * Run with: node scripts/make-icon.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'build')
const SIZE = 512

/* ------------------------------------------------------------------ draw */

const pixels = Buffer.alloc(SIZE * SIZE * 4)

const set = (x, y, [r, g, b, a]) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a === 0) return
  const i = (y * SIZE + x) * 4
  const alpha = a / 255
  pixels[i] = Math.round(pixels[i] * (1 - alpha) + r * alpha)
  pixels[i + 1] = Math.round(pixels[i + 1] * (1 - alpha) + g * alpha)
  pixels[i + 2] = Math.round(pixels[i + 2] * (1 - alpha) + b * alpha)
  pixels[i + 3] = Math.max(pixels[i + 3], a)
}

const lerp = (a, b, t) => a + (b - a) * t

// Rounded-square background with a vertical indigo gradient.
const RADIUS = SIZE * 0.22
const inRounded = (x, y) => {
  const cx = Math.min(Math.max(x, RADIUS), SIZE - RADIUS)
  const cy = Math.min(Math.max(y, RADIUS), SIZE - RADIUS)
  return (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2
}

for (let y = 0; y < SIZE; y++) {
  const t = y / SIZE
  const colour = [
    Math.round(lerp(99, 72, t)),
    Math.round(lerp(102, 76, t)),
    Math.round(lerp(241, 200, t))
  ]
  for (let x = 0; x < SIZE; x++) {
    if (inRounded(x, y)) set(x, y, [...colour, 255])
  }
}

// An open book: two pages meeting at a spine.
const white = [255, 255, 255, 245]
const shade = [226, 230, 245, 245]

const fillTri = (ax, ay, bx, by, cx, cy, colour) => {
  const minX = Math.floor(Math.min(ax, bx, cx))
  const maxX = Math.ceil(Math.max(ax, bx, cx))
  const minY = Math.floor(Math.min(ay, by, cy))
  const maxY = Math.ceil(Math.max(ay, by, cy))
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / area
      const w1 = ((cx - bx) * (y - by) - (cy - by) * (x - bx)) / area
      const w2 = ((ax - cx) * (y - cy) - (ay - cy) * (x - cx)) / area
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) set(x, y, colour)
    }
  }
}

const quad = (p, colour) => {
  fillTri(p[0], p[1], p[2], p[3], p[4], p[5], colour)
  fillTri(p[0], p[1], p[4], p[5], p[6], p[7], colour)
}

const L = SIZE * 0.16
const R = SIZE * 0.84
const M = SIZE * 0.5
const TOP = SIZE * 0.30
const BOT = SIZE * 0.74
const LIFT = SIZE * 0.05

quad([L, TOP + LIFT, M, TOP, M, BOT, L, BOT - LIFT * 0.4], white)
quad([M, TOP, R, TOP + LIFT, R, BOT - LIFT * 0.4, M, BOT], shade)

// Text lines on each page.
const line = (x0, x1, y, thickness, colour) => {
  for (let y2 = y; y2 < y + thickness; y2++) {
    for (let x = x0; x < x1; x++) set(Math.round(x), Math.round(y2), colour)
  }
}
const ink = [110, 118, 150, 200]
for (let i = 0; i < 5; i++) {
  const y = TOP + SIZE * 0.09 + i * SIZE * 0.062
  line(L + SIZE * 0.055, M - SIZE * 0.035, y + LIFT * (1 - i / 8), SIZE * 0.014, ink)
  line(M + SIZE * 0.035, R - SIZE * 0.055, y + LIFT * (i / 8), SIZE * 0.014, ink)
}

// Spine.
line(M - SIZE * 0.006, M + SIZE * 0.006, TOP, BOT - TOP, [140, 148, 190, 255])

/* ------------------------------------------------------------------ PNG */

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function toPng(rgba, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** Nearest-neighbour downscale — adequate for icon sizes below the source. */
function resize(rgba, from, to) {
  const out = Buffer.alloc(to * to * 4)
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      const sx = Math.floor((x * from) / to)
      const sy = Math.floor((y * from) / to)
      rgba.copy(out, (y * to + x) * 4, (sy * from + sx) * 4, (sy * from + sx) * 4 + 4)
    }
  }
  return out
}

/** ICO container holding several PNG-encoded entries. */
function toIco(sizes) {
  const images = sizes.map((s) => toPng(s === SIZE ? pixels : resize(pixels, SIZE, s), s))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  let offset = 6 + sizes.length * 16
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16)
    e[0] = s >= 256 ? 0 : s
    e[1] = s >= 256 ? 0 : s
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(images[i].length, 8)
    e.writeUInt32LE(offset, 12)
    offset += images[i].length
    return e
  })

  return Buffer.concat([header, ...entries, ...images])
}

mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'icon.png'), toPng(pixels, SIZE))
writeFileSync(path.join(outDir, 'icon.ico'), toIco([16, 24, 32, 48, 64, 128, 256]))
console.log('Wrote build/icon.png and build/icon.ico')
