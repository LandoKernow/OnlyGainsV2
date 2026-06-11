// Generates a VAPID ES256 key pair for web push.
// Public key: ships in the client config (safe, public by design).
// Private key: Cloudflare dashboard secret ONLY — never commit it.
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })

const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })

function b64urlToBuf(value) {
  return Buffer.from(value, 'base64url')
}

// Uncompressed point: 0x04 || x || y — the applicationServerKey format.
const rawPublic = Buffer.concat([Buffer.from([4]), b64urlToBuf(pub.x), b64urlToBuf(pub.y)])

console.log('VAPID_PUBLIC_KEY=' + rawPublic.toString('base64url'))
console.log('VAPID_PRIVATE_KEY=' + priv.d)
