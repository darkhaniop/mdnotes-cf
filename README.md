# mdnotes-cf

A markdown editor / notebook that runs entirely on Cloudflare: one Worker serves the API on
`/api/*` and the compiled React SPA via Workers Static Assets, D1 holds relational data and
markdown source, R2 holds uploaded images and PDFs.

See [`PLAN.md`](./PLAN.md) for the full design.

## Getting started

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in real secrets: openssl rand -base64 32
npm run db:migrate:local
npm run dev                      # http://localhost:5173 — real Worker + local D1/R2
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server running the real Worker (Miniflare) with local D1/R2 |
| `npm run build` | Build the client and Worker bundles into `dist/` |
| `npm run typecheck` | `tsc -b` over the app / worker / node TS projects |
| `npm run lint` | ESLint |
| `npm test` | Vitest — `worker` project (Workers pool) + `client` project (jsdom) |
| `npm run test:e2e` | Playwright against the local dev server |
| `npm run db:generate` | drizzle-kit: generate a SQL migration from `worker/db/schema.ts` |
| `npm run db:migrate:local` | Apply migrations to the local D1 |
| `npm run db:migrate:remote` | Apply migrations to the remote D1 (needs Cloudflare auth) |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |

## Before the first deploy

`wrangler.jsonc` ships with placeholder resource identifiers. Replace them with real ones:

```bash
npx wrangler login
npx wrangler d1 create mdnotes            # copy the id into d1_databases[0].database_id
npx wrangler r2 bucket create mdnotes-assets
npx wrangler secret put JWT_SECRET
npx wrangler secret put ASSET_COOKIE_SECRET
npm run db:migrate:remote
npm run deploy
```
