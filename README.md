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

`wrangler.jsonc` ships with placeholder resource identifiers, and nothing in this repo has ever
talked to a Cloudflare account. These steps need your credentials:

```bash
npx wrangler login
npx wrangler d1 create mdnotes             # copy the printed id into d1_databases[0].database_id
npx wrangler r2 bucket create mdnotes-assets
npx wrangler secret put JWT_SECRET         # paste `openssl rand -base64 32`
npx wrangler secret put ASSET_COOKIE_SECRET
npm run db:migrate:remote
npm run build && npm run deploy
```

`npx wrangler deploy --dry-run` works without any of the above and is what CI should use.

### Choose a PBKDF2 iteration count first

`PBKDF2_ITERATIONS` (a var in `wrangler.jsonc`, default `100000`) decides how much CPU a
signup/login/upgrade costs. Measured on workerd by `worker/__tests__/auth.test.ts`:

| Iterations | CPU per hash |
| --- | --- |
| 100 000 | ~36 ms |
| 25 000 | ~9 ms |

The Workers **Free** plan caps CPU at 10 ms per request, so the default needs Workers Paid
($5/mo). On the free plan set `PBKDF2_ITERATIONS` to `"25000"` before deploying. Guest login does
no hashing and is unaffected either way, and `verifyPassword` reads the iteration count out of each
stored hash, so changing this never locks existing users out.

## Security notes

- Access tokens are 15-minute HS256 JWTs held in memory only; the refresh token is opaque, stored
  as a SHA-256 in `sessions`, and rotated on every use.
- The `mdn_at` cookie exists only so `<img>`/`<object>` can load R2 assets, and is accepted only on
  read routes — a cookie alone can never mutate state.
- Uploads are checked against an allow-list *and* a magic-byte sniff; SVG is rejected outright.
- Markdown is sanitized before KaTeX and highlight.js run, and raw HTML is never rendered.
