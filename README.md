# Only Gains 2.0

Clean rebuild for Phase 1 of the Only Gains board experience.

## Current Phase 1 scope

- React + Vite app shell
- Supabase auth/session handling
- Profile basics from `public.profiles`
- Press-up logging hot path
- Optimistic Recent Activity
- Press-up leaderboard
- Chase derived from leaderboard data
- Delete own recent activity entry
- Lightweight personality copy
- No Arena
- No The 1%
- No awards
- No reactions
- No service worker yet

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Required environment variables

Copy `.env.example` to `.env` for local work.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_DEFAULT_CIRCLE_ID=
VITE_APP_NAME=Only Gains 2.0
VITE_APP_ENV=development
```

Use the Supabase project root URL, not the REST endpoint.

Correct:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
```

Not this:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co/rest/v1/
```

## Build and deploy

This project is deployed to Cloudflare Workers using Wrangler or a CI that publishes a Worker build artifact. The live staging URL for V2 is:

- https://onlygainsv2.gautie.workers.dev

Recommended deploy flows

- Local publish (manual testing):

	1. Build the app: `npm run build`
	2. Publish with Wrangler (configured to upload `dist` or the Worker bundle): `npx wrangler publish`

- CI / GitHub-triggered deploy (preferred):

	- Configure GitHub Actions or your CI to run `npm ci && npm run build` and publish with `wrangler publish` or push the artifact to Cloudflare via the Wrangler GitHub Action. This provides repeatable, auditable deploys and is the recommended path for staging and production.

Notes on routing and Workers

- When deployed as a Cloudflare Worker you do not rely on `public/_redirects` (Cloudflare Pages). Ensure your Worker routes send SPA requests to the built `index.html` (or serve the static assets) so routes like `/dashboard` and `/leaderboard` resolve properly.

- If you use a Cloudflare Worker that sits behind a custom hostname, make sure that hostname is allowed in your Supabase redirect URLs (see below).

## Supabase auth redirect URL checklist

In Supabase `Authentication -> URL Configuration`, add redirect URLs for:

### Local development

- `http://localhost:5173/*`
- `http://localhost:5174/*`
- `http://localhost:5175/*`
- `http://localhost:5176/*`

Notes:

- Vite may move ports if one is already occupied.
- Add the exact active local URL when needed.

### Staging

Examples:

- `https://<your-cloudflare-preview>.pages.dev/*`
- `https://v2.onlygains.club/*`

### Production

Example:

- `https://onlygains.club/*`

The app requests magic-link return to `/dashboard` on the current origin, so the active deployed origin must be allowed in Supabase.

## Mobile-first staging checklist

Test on a real mobile device:

1. Open the staging URL on mobile.
2. Sign in by magic link.
3. Confirm the redirect returns to V2 staging, not V1.
4. Tap `+10`.
5. Confirm instant tap feedback.
6. Confirm Recent Activity updates.
7. Confirm Leaderboard updates.
8. Confirm Chase updates.
9. Delete your own entry.
10. Toggle weekly/monthly/yearly.
11. Fast scroll Dashboard and Ranks.
12. Close and reopen the browser.
13. Confirm session persists.

## Performance guardrails for staging

- Mobile-first shell
- No service worker yet
- No hidden heavy screens
- No blocking image assets
- Logging tap feedback should stay under 100ms
- Dashboard should remain fast under repeated quick logs

## Release-prep notes

- App code does not depend on local file paths for runtime behavior.
- Remaining `localhost` references are in docs, build artifacts, or third-party packages rather than app runtime logic.
- Profile screen exposes a lightweight build marker for easier staging verification.
