// Gera os ícones PNG do app (sem dependências): "M" azul pastel sobre preto.
// Uso: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0, 0, 0]
const FG = [0x9c, 0xc3, 0xff] // --color-brand
// Traço do "M" em coordenadas 0..1 (dentro da zona segura de ícones "maskable").
const POINTS = [
  [0.29, 0.69],
  [0.29, 0.32],
  [0.5, 0.56],
  [0.71, 0.32],
  [0.71, 0.69],
]
const STROKE = 0.085
const SS = 4 // supersampling para bordas suaves

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function coverage(x, y) {
  let d = Infinity
  for (let i = 0; i < POINTS.length - 1; i++) d = Math.min(d, distToSegment(x, y, POINTS[i], POINTS[i + 1]))
  return d <= STROKE / 2 ? 1 : 0
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // filtro "none"
    for (let x = 0; x < size; x++) {
      let a = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) a += coverage((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
      a /= SS * SS
      const o = y * (size * 3 + 1) + 1 + x * 3
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/icons/${name}`, png(size))
  console.log('ok', name)
}

const path = POINTS.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 64).toFixed(1)} ${(y * 64).toFixed(1)}`).join(' ')
writeFileSync(
  'public/icons/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#000"/><path d="${path}" fill="none" stroke="#9cc3ff" stroke-width="${(STROKE * 64).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`,
)
console.log('ok favicon.svg')
