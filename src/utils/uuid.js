export function createClientId() {
  const cryptoObject = globalThis.crypto

  if (typeof cryptoObject?.randomUUID === 'function') {
    return cryptoObject.randomUUID()
  }

  if (typeof cryptoObject?.getRandomValues === 'function') {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (character) => {
      const randomValue = cryptoObject.getRandomValues(new Uint8Array(1))[0]
      return (Number(character) ^ (randomValue & (15 >> (Number(character) / 4)))).toString(16)
    })
  }

  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
