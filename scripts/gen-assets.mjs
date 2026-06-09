// Generates the extension's binary assets deterministically from code:
//  - PNG icons (16/32/48/128) : a gradient disc (Twitch purple -> Kick green)
//    with a white play triangle.
//  - WAV alert chime : a short two-note ping with exponential decay.
// No external deps: PNG is hand-encoded via zlib, WAV is raw PCM.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
// Kept at project root (not public/) so CRXJS resolves the manifest icon paths
// and web_accessible_resources globs directly.
const iconsDir = resolve(root, 'icons')
const soundsDir = resolve(root, 'sounds')
mkdirSync(iconsDir, { recursive: true })
mkdirSync(soundsDir, { recursive: true })

/* ----------------------------- PNG encoder ------------------------------ */
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (~c) >>> 0
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

/* ------------------------------- drawing -------------------------------- */
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.max(0, Math.min(1, v))

// Twitch #a970ff -> Kick #53fc18
const C1 = [0xa9, 0x70, 0xff]
const C2 = [0x53, 0xfc, 0x18]

function sign(ax, ay, bx, by, cx, cy) {
  return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy)
}
function inTriangle(px, py, t) {
  const d1 = sign(px, py, t[0], t[1], t[2], t[3])
  const d2 = sign(px, py, t[2], t[3], t[4], t[5])
  const d3 = sign(px, py, t[4], t[5], t[0], t[1])
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const r = size / 2 - Math.max(0.5, size * 0.015)
  // play triangle (slightly right-shifted to look optically centered)
  const tri = [
    size * 0.40, size * 0.30,
    size * 0.40, size * 0.70,
    size * 0.72, size * 0.50,
  ]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      // anti-aliased disc mask
      const edge = clamp01(r - dist + 0.5)
      if (edge <= 0) {
        rgba[i + 3] = 0
        continue
      }
      const t = clamp01((x + y) / (2 * (size - 1)))
      let R = Math.round(lerp(C1[0], C2[0], t))
      let G = Math.round(lerp(C1[1], C2[1], t))
      let B = Math.round(lerp(C1[2], C2[2], t))
      // subtle radial darkening toward the rim for depth
      const shade = lerp(1, 0.82, clamp01(dist / r))
      R = Math.round(R * shade)
      G = Math.round(G * shade)
      B = Math.round(B * shade)
      // white play triangle on top
      if (inTriangle(x + 0.5, y + 0.5, tri)) {
        R = 255
        G = 255
        B = 255
      }
      rgba[i] = R
      rgba[i + 1] = G
      rgba[i + 2] = B
      rgba[i + 3] = Math.round(255 * edge)
    }
  }
  return encodePNG(size, size, rgba)
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(iconsDir, `icon-${size}.png`), drawIcon(size))
}

/* ------------------------------- WAV chime ------------------------------ */
function encodeWAV(samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    data.writeInt16LE(Math.round(s * 32767), i * 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20) // PCM
  h.writeUInt16LE(1, 22) // mono
  h.writeUInt32LE(sampleRate, 24)
  h.writeUInt32LE(sampleRate * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

function chime() {
  const sr = 44100
  const notes = [
    { f: 880.0, start: 0.0, dur: 0.28 }, // A5
    { f: 1174.66, start: 0.16, dur: 0.42 }, // D6
  ]
  const total = Math.ceil(sr * 0.62)
  const out = new Float32Array(total)
  for (const n of notes) {
    const s0 = Math.floor(n.start * sr)
    const len = Math.floor(n.dur * sr)
    for (let i = 0; i < len; i++) {
      const tt = i / sr
      const env = Math.exp(-tt * 9) // fast decay -> "ping"
      const wave = Math.sin(2 * Math.PI * n.f * tt) * 0.5 + Math.sin(2 * Math.PI * n.f * 2 * tt) * 0.12
      const idx = s0 + i
      if (idx < total) out[idx] += wave * env * 0.6
    }
  }
  return encodeWAV(out, sr)
}

writeFileSync(resolve(soundsDir, 'alert.wav'), chime())

console.log('Generated icons (16/32/48/128) + alert.wav')
