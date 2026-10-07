// Renders the app icon (same design as public/icon.svg) to PNG without external dependencies.
// Usage: node scripts/build-icons.mjs

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x2c, 0x6e, 0x4f];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Coverage of the icon's white ring at a point (0..1), in 512-unit coordinates.
function ringAlpha(x, y) {
  const dx = x - 256, dy = y - 256;
  const r = Math.hypot(dx, dy);
  const inRing = Math.abs(r - 140) <= 24;
  // Angle measured clockwise from 12 o'clock.
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += 2 * Math.PI;
  const onArc = a <= 1.5 * Math.PI;
  // Round caps at the arc ends.
  const capDist = Math.min(Math.hypot(x - 256, y - 116), Math.hypot(x - 116, y - 256));
  if ((inRing && onArc) || capDist <= 24) return 1;
  if (inRing) return 0.3;
  return 0;
}

function render(size, rounded) {
  const ss = 4; // supersampling
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const radius = rounded ? 112 : 0;
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const x = ((px + (sx + 0.5) / ss) / size) * 512;
        const y = ((py + (sy + 0.5) / ss) / size) * 512;
        // Rounded-rect mask.
        const cx = Math.max(radius - x, 0, x - (512 - radius));
        const cy = Math.max(radius - y, 0, y - (512 - radius));
        if (radius && Math.hypot(cx, cy) > radius) continue;
        const w = ringAlpha(x, y);
        r += BG[0] + (255 - BG[0]) * w;
        g += BG[1] + (255 - BG[1]) * w;
        b += BG[2] + (255 - BG[2]) * w;
        a += 255;
      }
      const n = ss * ss;
      const o = py * (size * 4 + 1) + 1 + px * 4;
      const cov = a / 255 || 1;
      raw[o] = Math.round(r / cov); raw[o + 1] = Math.round(g / cov); raw[o + 2] = Math.round(b / cov);
      raw[o + 3] = Math.round(a / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Apple applies its own corner mask, and maskable icons need a full-bleed background.
writeFileSync('public/icon-180.png', render(180, false));
writeFileSync('public/icon-192.png', render(192, true));
writeFileSync('public/icon-512.png', render(512, false));
console.log('Icons written to public/');
