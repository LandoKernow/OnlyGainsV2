// Shuffle-bag image rotation for the macho takeover.
// All images get shuffled into a deck; each trigger deals one; the deck only
// reshuffles when empty — so no image repeats until every image has shown.
// Deck state persists per user in localStorage, so repeats can't sneak in
// across reloads or sessions. New images in the manifest join the current
// deck automatically (appended in shuffled order); removed images are culled.

import { MACHO_TAKEOVER_CONFIG } from '../config/machoTakeover'

const DECK_KEY_PREFIX = 'only_gains_macho_deck_v1'

let manifestPromise = null

function getDeckStorageKey(userId) {
  return `${DECK_KEY_PREFIX}_${userId || 'anon'}`
}

function readDeck(userId) {
  try {
    const raw = globalThis.localStorage?.getItem(getDeckStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : null
  } catch {
    return null
  }
}

function writeDeck(userId, deck) {
  try {
    globalThis.localStorage?.setItem(getDeckStorageKey(userId), JSON.stringify(deck))
  } catch {
    // Restrictive storage: rotation degrades to per-session, never breaks.
  }
}

function shuffle(items) {
  const deck = [...items]

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}

export async function fetchMachoManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MACHO_TAKEOVER_CONFIG.manifestUrl)
      .then((response) => (response.ok ? response.json() : { images: [] }))
      .then((manifest) => (Array.isArray(manifest?.images) ? manifest.images : []))
      .catch(() => [])
  }

  return manifestPromise
}

// Deals the next image from the user's deck. Reshuffles only when empty.
export async function dealMachoImage(userId) {
  const allImages = await fetchMachoManifest()

  if (allImages.length === 0) {
    return null
  }

  const known = new Set(allImages)
  let deck = (readDeck(userId) ?? []).filter((image) => known.has(image))

  // Images added to the folder since the deck was cut join mid-deck, shuffled.
  const inDeckOrSeen = new Set(deck)
  const freshDrops = allImages.filter((image) => !inDeckOrSeen.has(image))

  if (deck.length === 0) {
    deck = shuffle(allImages)
  } else if (freshDrops.length > 0 && readDeck(userId) !== null) {
    deck = shuffle([...deck, ...freshDrops])
  }

  const dealt = deck.pop()
  writeDeck(userId, deck)

  // Preload the NEXT image so the following reveal never lags.
  const next = deck[deck.length - 1]

  if (next && typeof Image !== 'undefined') {
    const preloader = new Image()
    preloader.src = next
  }

  return dealt ?? null
}

// Warms the cache for the first reveal of the session.
export async function preloadNextMachoImage(userId) {
  const allImages = await fetchMachoManifest()

  if (allImages.length === 0 || typeof Image === 'undefined') {
    return
  }

  const known = new Set(allImages)
  const deck = (readDeck(userId) ?? []).filter((image) => known.has(image))
  const next = deck.length > 0 ? deck[deck.length - 1] : allImages[0]

  if (next) {
    const preloader = new Image()
    preloader.src = next
  }
}
