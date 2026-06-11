// Scans public/images/macho/ and writes manifest.json next to the images.
// Runs automatically before dev and build (see package.json pre-scripts), so
// dropping a new image into the folder auto-registers it — no code change.
import { readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const machoDir = join(here, '..', 'public', 'images', 'macho')

const IMAGE_EXTENSIONS = /\.(webp|png|jpe?g|avif|gif)$/i

const images = readdirSync(machoDir)
  .filter((name) => IMAGE_EXTENSIONS.test(name))
  .sort()
  .map((name) => `/images/macho/${name}`)

const manifest = {
  generatedAt: new Date().toISOString(),
  count: images.length,
  images,
}

writeFileSync(join(machoDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`[macho-manifest] ${images.length} images registered.`)
