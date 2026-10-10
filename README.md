# ONLYGAINS — Hybrid Training Club

RUN · LIFT · HYROX · REPEAT. A competitive training board: log press-ups,
pull-ups and kilometres, climb the weekly ranks, hold the crowns, keep the
streak alive. Live at https://onlygains.club.

## Stack

- React 19 + Vite 7 single-page app (mobile-first PWA)
- Supabase (auth, Postgres, RPCs) via `@supabase/supabase-js`
- TanStack Query for server state; React Router for routes
- Cloudflare Worker (`worker/index.js`) for the notification engine, web push
  and the scheduled crown / streak sweeps — static assets are served from
  `dist/` by Workers Static Assets

## Commands

```bash
npm install
npm run dev       # local dev server on :5173 (regenerates the macho image manifest)
npm test          # vitest — leaderboard, streak, XP, chase, paging logic
npm run build     # production build into dist/
npm run preview
```

## Environment

Copy `.env.example` to `.env` for local work.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co   # project root, not /rest/v1/
VITE_SUPABASE_ANON_KEY=
VITE_DEFAULT_CIRCLE_ID=
VITE_APP_NAME=ONLYGAINS
VITE_APP_ENV=development
VITE_PUBLIC_BASE_URL=   # optional: override the share-link origin (preview envs)
```

Worker secrets (Cloudflare dashboard): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`, `TEST_FIRE_TOKEN`. `keep_vars` in `wrangler.jsonc` keeps them
across deploys.

## Where things live

| Area | Files |
| --- | --- |
| Logging write path (keep it boring) | `screens/dashboard` → `hooks/useActivityLogger` → `api/submissions.createSubmission` |
| Disciplines registry | `src/utils/activityTypes.js` — add activities here |
| Ranks / chase / tiers / streaks / XP | `src/logic/leaderboard`, `src/utils/war.js`, `src/utils/xp.js` |
| Tuning surfaces | `src/config/*.js` (onboarding, crowns, notifications, macho takeover, referrals) |
| Brand | `src/components/Brand.jsx`, `scripts/build_brand_assets.py`, tokens in `src/styles/globals.css` |
| DB migrations (run by hand in Supabase SQL editor) | `db/migrations/` |

Leaderboard caches are plain arrays keyed `['leaderboard', activityType, boardId, year]`;
the optimistic logging updates depend on that shape.

## Supabase auth redirect URLs

Add each origin the app runs on under Authentication → URL Configuration:
`http://localhost:5173/*` (and neighbouring Vite ports), `https://onlygains.club/*`,
`https://v2.onlygains.club/*`, and the Workers preview domain.

## Caching

`public/_headers` marks Vite's content-hashed `/assets/*` as immutable, so
repeat visits only download what a deploy actually changed. A tab left open
across a deploy reloads itself onto the new build the first time it needs a
lazy screen (`vite:preloadError` handler in `src/main.jsx`).
