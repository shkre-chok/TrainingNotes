# Running this project locally in VS Code

This project was built on Replit, which auto-provisions Postgres, object
storage, and env vars for you. Outside Replit those pieces need a little
manual setup — this doc walks through it once, end to end.

## 1. Prerequisites

- Node.js 24 (`node -v`)
- pnpm (`corepack enable` or `npm i -g pnpm`)
- Docker Desktop (or another local Docker) for Postgres

## 2. Clone and install

```sh
git clone <this repo>
cd TrainingNotes
pnpm install
```

## 3. Configure environment variables

```sh
cp .env.example .env
```

The defaults in `.env.example` work out of the box for local dev:
- `OBJECT_STORAGE_DRIVER=local` — uploads are written to disk under
  `.data/objects` instead of a cloud bucket. No credentials needed.
- `EMAIL_DRIVER=console` — homework reminder emails are printed to the
  terminal instead of sent via Gmail.

Both of these are the *local dev* answer, not the production one — see
"Going further" below for what changes when you're ready to deploy off
Replit for real.

## 4. Start Postgres

```sh
pnpm db:up      # docker compose up -d
pnpm db:push    # push the Drizzle schema to it
```

`pnpm db:down` stops it when you're done. Data persists in a Docker volume
across restarts; delete it with `docker compose down -v` if you want a
clean slate.

## 5. Run the app

In two terminals (or two VS Code tasks — see below):

```sh
pnpm dev:api    # API server on http://localhost:8080
pnpm dev:web    # Web app on http://localhost:5173
```

Open http://localhost:5173 in a browser.

## 6. Using VS Code

This repo ships `.vscode/` config:

- **Tasks** (`Cmd/Ctrl+Shift+P` → "Run Task"): `docker: start postgres`,
  `db: push schema`, `dev: api-server`, `dev: web (rehab-tracker)`.
- **Debugging** (`Run and Debug` panel):
  - **Debug API Server** — builds the server and launches it with
    breakpoints working directly in the TypeScript source (sourcemaps are
    wired through).
  - **Open Web App (rehab-tracker)** — opens the running dev server in a
    debuggable Chrome instance. Start `dev: web (rehab-tracker)` first.
- Recommended extensions (Prettier, Tailwind CSS IntelliSense, Docker,
  DotENV) are suggested automatically when you open the folder.

## What's still Replit-only

A few things intentionally weren't touched, since they only matter once you
decide how (and whether) to move production off Replit too:

- `artifacts/*/vite.config.ts` still import Replit's dev-banner/cartographer
  plugins — they're already gated behind `REPL_ID` so they're inert
  locally, just left in place.
- `lib/object-storage-web` and `objectStorage.ts`'s GCS path still assume
  Replit's sidecar for cloud auth when `OBJECT_STORAGE_DRIVER=gcs`.
- `email.ts`'s Gmail path still goes through `@replit/connectors-sdk` when
  `EMAIL_DRIVER=gmail`.
- `artifacts/homework-mobile` (the Expo app) still expects
  `REPLIT_DEV_DOMAIN`/`REPLIT_EXPO_DEV_DOMAIN` for its dev script; running
  it locally needs its own Expo setup and isn't covered here yet.

## Going further: moving production off Replit

When you're ready to decide on real infrastructure instead of the local
dev fallbacks:

- **Object storage**: set `OBJECT_STORAGE_DRIVER=gcs`, provision a GCS
  bucket, and set up standard Google credentials (e.g.
  `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service account key)
  instead of the Replit sidecar. `PUBLIC_OBJECT_SEARCH_PATHS` and
  `PRIVATE_OBJECT_DIR` point at paths inside that bucket. Moving to AWS S3
  instead would mean swapping `@google-cloud/storage` for an S3 client in
  `artifacts/api-server/src/lib/objectStorage.ts` — bigger change, not done
  here.
- **Email**: set `EMAIL_DRIVER=gmail` and provide real Gmail API
  credentials (OAuth or a service account with domain-wide delegation), or
  swap in an SMTP provider (e.g. Postmark, SES, Resend) in `email.ts`.
- **Database**: any managed Postgres (Neon, Supabase, RDS, etc.) works —
  just point `DATABASE_URL` at it.
- **Hosting**: `artifacts/api-server` builds to a single bundled
  `dist/index.mjs` (via `pnpm --filter @workspace/api-server run build`)
  that runs anywhere Node runs; `artifacts/rehab-tracker` builds to static
  files (via its own `build` script) servable from any static host or CDN.
