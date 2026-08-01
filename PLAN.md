# mdnotes-cf — Implementation Plan

## Context

We are building a markdown editor/notebook app from scratch that runs on **Cloudflare**: a single
Worker serves both the API and the compiled SPA, D1 holds all relational data and markdown source, R2
holds user-uploaded images and PDFs. Users can start instantly as a guest, later upgrade that same
account to an email/password login without losing work, group documents into projects, upload
assets into a project, and reference those assets from markdown by relative path. Documents have a
read-only view mode and an edit mode with a side-by-side preview that can be collapsed.

---

## Locked stack decisions

| Area | Choice |
| --- | --- |
| Deploy | One Worker: API on `/api/*`, SPA via Workers Static Assets (`not_found_handling: single-page-application`) |
| Dev | `@cloudflare/vite-plugin` ^1.52 — `vite dev` runs the real Worker + local D1/R2 in one process |
| API | Hono ^4.13 + `@hono/zod-validator` |
| DB | D1 + Drizzle ORM ^0.45 / drizzle-kit ^0.31, SQL migrations applied by `wrangler d1 migrations apply` |
| Auth | 15-min HS256 access JWT (`jose` ^6) in memory + opaque rotating refresh token in an httpOnly cookie, hashed in D1 `sessions`. PBKDF2-SHA256 password hashing (Web Crypto). No email is ever sent |
| Guests | Real `users` row with `is_guest = 1`; sign-up mutates that row in place — projects/assets untouched |
| Doc storage | `documents.content TEXT` in D1 (1 MB cap); R2 stores only uploaded images/PDFs |
| Frontend | Vite 8 + React 19 + TS, React Router ^8 **as a library** (`createBrowserRouter` + `RouterProvider`; no SSR, no framework mode, no loaders), Tailwind v4, shadcn/ui |
| Client libs | TanStack Query ^5, react-hook-form ^7 + zod ^4, Zustand ^5, react-dropzone, sonner |
| Editor | `@uiw/react-codemirror` ^4 + `@codemirror/lang-markdown` |
| Renderer | react-markdown ^10 + remark-gfm + remark-math + rehype-sanitize + rehype-katex + rehype-highlight, plus a lazy Mermaid code-block component |
| Tests | Vitest ^4 (two projects: `@cloudflare/vitest-pool-workers` ^0.21 for the Worker, jsdom + Testing Library for the client) and Playwright ^1.62 for e2e |

---

## Repository layout

Single npm package, three TypeScript project references. Rationale: the Cloudflare Vite plugin
builds the Worker and the client from one Vite graph; splitting into npm workspaces adds build-order
friction for no isolation benefit here. Separation is enforced by directory + tsconfig boundaries.

```
mdnotes-cf/
├── PLAN.md
├── wrangler.jsonc              # main -> worker/index.ts, assets/D1/R2 bindings
├── vite.config.ts              # react + tailwind + cloudflare plugins
├── vitest.config.ts            # projects: ["worker", "client"]
├── playwright.config.ts        # webServer: npm run dev
├── drizzle.config.ts
├── components.json             # shadcn
├── tsconfig.json / .app.json / .worker.json / .node.json
├── .dev.vars                   # gitignored: JWT_SECRET, ASSET_COOKIE_SECRET
├── migrations/                 # 0001_init.sql … (drizzle-kit generated)
├── shared/                     # imported by BOTH sides — zod schemas + inferred DTO types
│   ├── schemas/{auth,project,document,asset}.ts
│   └── constants.ts            # MAX_UPLOAD_BYTES, ALLOWED_MIME, MAX_DOC_BYTES
├── worker/
│   ├── index.ts                # Hono app, binding types, error handler
│   ├── routes/{auth,projects,documents,assets}.ts
│   ├── middleware/{auth,error,ratelimit}.ts
│   ├── lib/{jwt,password,cookies,ids,r2,assetName}.ts
│   ├── db/{schema.ts,client.ts}
│   └── __tests__/*.test.ts
├── src/                        # React SPA
│   ├── main.tsx, router.tsx, App.tsx
│   ├── routes/                 # route components (see Routes)
│   ├── components/{ui,markdown,editor,project,layout}/
│   ├── hooks/                  # useDocument, useProjects, useAssets, useAuth
│   ├── lib/{api-client.ts,auth-store.ts,ui-store.ts,markdown.ts,utils.ts}
│   └── __tests__/
└── e2e/*.spec.ts
```

---

## Data model (`worker/db/schema.ts` → `migrations/0001_init.sql`)

All ids are UUIDv7-ish strings (`crypto.randomUUID()`), timestamps stored as integer epoch ms.

- **users** — `id` PK, `email` TEXT UNIQUE NULL, `password_hash` TEXT NULL, `is_guest` INT NOT NULL
  DEFAULT 1, `email_verified` INT DEFAULT 0, `created_at`, `updated_at`, `last_seen_at`
- **sessions** — `id` PK, `user_id` → users ON DELETE CASCADE, `refresh_hash` TEXT UNIQUE (SHA-256 of
  the opaque token), `expires_at`, `created_at`, `user_agent`; index on `user_id`, `expires_at`
- **projects** — `id` PK, `user_id` → users CASCADE, `name`, `slug`, `description`, `created_at`,
  `updated_at`; UNIQUE(`user_id`,`slug`), index on `user_id`
- **documents** — `id` PK, `project_id` → projects CASCADE, `title`, `slug`, `content` TEXT NOT NULL
  DEFAULT '', `created_at`, `updated_at`; UNIQUE(`project_id`,`slug`), index on `project_id`
- **assets** — `id` PK, `project_id` → projects CASCADE, `filename` TEXT, `r2_key` TEXT UNIQUE,
  `content_type`, `size_bytes`, `sha256`, `created_at`; UNIQUE(`project_id`,`filename`),
  index on `project_id`

R2 key layout: `p/{projectId}/{assetId}/{filename}`. D1 FK cascades do **not** delete R2 objects —
project/asset deletion handlers must list keys and call `BUCKET.delete(keys[])` explicitly
(`worker/lib/r2.ts:deleteProjectObjects`).

---

## API surface (Hono, all under `/api`)

**Auth** (`worker/routes/auth.ts`)
- `POST /auth/guest` → creates `is_guest=1` user, returns token pair
- `POST /auth/signup` `{email,password}` → new non-guest user
- `POST /auth/login` `{email,password}`
- `POST /auth/upgrade` `{email,password}` (auth required, 409 unless caller is a guest) → sets
  `email`/`password_hash`, `is_guest=0` on the **same** row; all projects/assets carry over
- `POST /auth/refresh` → validates + **rotates** the refresh token (old row deleted), new access JWT
- `POST /auth/logout` → deletes the session row, clears cookies
- `GET /auth/me`

**Projects** — `GET|POST /projects`, `GET|PATCH|DELETE /projects/:id`
**Documents** — `GET|POST /projects/:id/documents`, `GET|PATCH|DELETE /documents/:docId`
**Assets** — `GET|POST /projects/:id/assets`, `GET /projects/:id/assets/:assetId`,
`GET /projects/:id/assets/by-name/:name`, `DELETE /assets/:assetId`

Every project-scoped handler goes through `requireOwnership(projectId)` in
`worker/middleware/auth.ts`, which joins on `user_id` and returns 404 (not 403) for foreign rows.
Zod validation via `zValidator('json', schema)` using the **shared** schemas so client and server
agree by construction.

---

## Auth mechanics

Two cookies are set alongside the JSON response on guest/signup/login/refresh:

| Cookie | Contents | Attributes | Purpose |
| --- | --- | --- | --- |
| `mdn_rt` | opaque 32-byte random, SHA-256 stored in `sessions` | HttpOnly, Secure, SameSite=Strict, Path=/api/auth, 30 d | refresh + revocation |
| `mdn_at` | HMAC-signed `userId.exp` (stateless) | HttpOnly, Secure, SameSite=Lax, Path=/api/projects, 30 min | lets `<img>`/`<object>` tags fetch R2 assets, which cannot send an `Authorization` header |

Only asset **GET** routes accept the `mdn_at` cookie; every mutating route requires the Bearer
access JWT, so a cookie alone can never change state (CSRF-safe by construction). The access JWT
lives in a Zustand store in memory only; `src/lib/api-client.ts` attaches it and, on a 401, performs
a single de-duplicated `/auth/refresh` then replays the request. Refresh via the cookie is what
survives a page reload.

Password hashing: PBKDF2-SHA256, 100 000 iterations, 16-byte salt, stored as
`pbkdf2$sha256$<iters>$<salt_b64>$<hash_b64>` (`worker/lib/password.ts`), with constant-time
comparison. bcrypt/argon2 cannot run on Workers.

> **Risk to check early (Phase 2):** the Workers **Free** plan caps CPU at 10 ms per request;
> 100 k PBKDF2 iterations will exceed that. Measure with `wrangler dev` + `--test-scheduled`-style
> timing in the auth tests. Mitigation is Workers Paid ($5/mo) or dropping to ~25 k iterations —
> make the iteration count an env var (`PBKDF2_ITERATIONS`) so this is a config change, not a code
> change. Guest login is unaffected (no hashing).

---

## Assets: upload, naming, relative-path references

**Upload** — `POST /api/projects/:id/assets`, `multipart/form-data`, parsed with
`c.req.formData()`. Validation order: size ≤ 25 MB (`MAX_UPLOAD_BYTES`), declared MIME in
`ALLOWED_MIME` = png/jpeg/webp/gif/pdf, then a **magic-byte sniff** of the first 8 bytes to confirm
the declared type. SVG is rejected (XSS vector). Filenames are slugified and de-duplicated per
project (`report.pdf` → `report-1.pdf`) in `worker/lib/assetName.ts`; the stored `filename` is what
markdown references.

**Serving** — `GET /api/projects/:id/assets/:assetId` streams `object.body` with the stored
content-type, `ETag` from `object.httpEtag`, `Cache-Control: private, max-age=31536000, immutable`,
and honours `If-None-Match` → 304. PDFs get `Content-Disposition: inline`.

**Relative references** — `src/lib/markdown.ts` exports `makeUrlTransform(projectId)` passed to
react-markdown's `urlTransform`:

```
absolute http(s):/mailto:/data:image/  -> returned unchanged (then sanitized)
anything else                          -> basename, decoded, slug-normalized
                                       -> /api/projects/{projectId}/assets/by-name/{name}
```

So `![diagram](diagram.png)`, `![](./img/diagram.png)` and `[spec](spec.pdf)` all resolve to the
project asset named `diagram.png` / `spec.pdf`. The namespace is flat and matched on basename —
predictable, and it means moving a file between folders in a reference never breaks it. The by-name
route resolves `UNIQUE(project_id, filename)` → `r2_key` and 404s with a placeholder image for
unknown names so a broken reference doesn't look like an app error.

The asset sidebar inserts `![name](name.png)` (or a link for PDFs) at the CodeMirror cursor on
click, and react-dropzone uploads on drop anywhere in the editor.

---

## Markdown pipeline (`src/components/markdown/MarkdownPreview.tsx`)

```
remarkPlugins: [remarkGfm, remarkMath]
rehypePlugins: [ [rehypeSanitize, schema], rehypeKatex, rehypeHighlight ]
urlTransform:  makeUrlTransform(projectId)
```

Order is deliberate: **sanitize first**, then let KaTeX and highlight.js generate their (trusted)
markup from already-clean text — this avoids the classic bug where sanitize strips KaTeX's spans.
The custom `schema` extends `defaultSchema` to keep `className` values `math-inline` /
`math-display` on `span`/`div` (otherwise rehype-katex can't find the math nodes) plus
`language-*` on `code`.

- **Math** — `$inline$` and `$$block$$` via remark-math + rehype-katex; import `katex/dist/katex.min.css` once in `main.tsx`.
- **Mermaid** — a `components.code` override intercepts `language-mermaid` fences and renders
  `<MermaidDiagram/>`, which does `await import('mermaid')` (keeps ~500 KB out of the main bundle),
  `mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme })`, then
  `mermaid.render(uniqueId, code)` inside an effect keyed on the code string. Parse errors render an
  inline error card instead of throwing — essential while typing a diagram in the live preview.
- **Images/PDFs** — `components.img` renders with lazy loading and a broken-asset fallback;
  `components.a` detects `.pdf` and renders an inline `<object>` preview card with an open/download
  action.
- Preview input is debounced through `useDeferredValue` + a 200 ms debounce so typing stays smooth.

---

## Routes and UI

`src/router.tsx` — `createBrowserRouter`, `<RequireAuth>` wrapper that bootstraps via
`/auth/refresh` before rendering (avoids a login flash on reload).

| Path | Screen |
| --- | --- |
| `/` | landing: "Continue as guest" / log in / sign up |
| `/login`, `/signup` | react-hook-form + zod; when the current user is a guest, sign-up calls `/auth/upgrade` and shows "your work will be kept" |
| `/projects` | project list + create dialog |
| `/projects/:projectId` | document list, asset panel (dropzone + grid), rename/delete |
| `/projects/:projectId/docs/:docId` | **view mode** — rendered markdown, "Edit" button |
| `/projects/:projectId/docs/:docId/edit` | **edit mode** — CodeMirror ⇄ preview split |

Edit mode uses a resizable two-pane layout (shadcn `resizable`); the preview collapses via a toolbar
toggle button whose state lives in the Zustand `ui-store` and persists to localStorage. Autosave is
a 800 ms-debounced `PATCH /documents/:id` sending the last-known `updatedAt` for optimistic
concurrency (409 → "changed elsewhere, reload" toast), plus explicit ⌘/Ctrl-S. TanStack Query
holds documents/projects/assets; a save writes through to the cache so switching to view mode is
instant.

shadcn components to add: `button card dialog input label textarea dropdown-menu tabs resizable
skeleton sonner tooltip alert-dialog scroll-area separator badge form`.

---

## Testing

**Worker unit/integration** — `@cloudflare/vitest-pool-workers` gives real D1 + R2 bindings from
Miniflare; a `globalSetup` applies `migrations/` to the test D1.

**E2E (Playwright)** — `webServer` runs `npm run dev` (real Worker + local D1/R2). Primary flow:
guest → create project → drop a PNG → new document → type `![](shot.png)` + `$E=mc^2$` + a mermaid
fence → assert image loads (200) and KaTeX/SVG render → hide preview → save → open view mode →
sign up → assert the project and document are still there. Second flow: log out / log back in.

---

## Implementation phases (one or more commits each, conventional-commit messages)

0. **`chore: init`** — copy this plan to `PLAN.md`, `.gitignore`, `README.md`.
1. **Scaffold** — Vite + React TS, Tailwind v4, shadcn init, `wrangler.jsonc` (D1 + R2 + assets
   bindings), `@cloudflare/vite-plugin`, tsconfig references, `wrangler types`, npm scripts
   (`dev build deploy test test:e2e db:generate db:migrate:local db:migrate:remote lint typecheck`).
   Create the D1 database and R2 bucket via wrangler and record the ids. ✅ `vite dev` serves a
   placeholder page and `/api/health` from the same origin.
2. **Data layer** — drizzle schema, generate `0001_init.sql`, apply locally, `worker/db/client.ts`,
   shared zod schemas.
3. **Auth** — `jwt.ts`, `password.ts`, `cookies.ts`, auth routes, auth middleware, rate limiting on
   login/signup (D1-backed counter), Worker tests. **Measure PBKDF2 CPU here.**
4. **Client shell** — router, auth store, api-client with refresh queue, layout/nav, landing +
   login/signup/guest screens, `RequireAuth`.
5. **Projects** — CRUD routes + ownership middleware + tests; projects list/detail UI with TanStack
   Query hooks.
6. **Assets** — upload/list/serve/delete routes, magic-byte validation, filename dedup, R2 cleanup
   on delete, `mdn_at` cookie auth for GETs, tests; dropzone + asset grid UI.
7. **Documents + view mode** — document CRUD, markdown pipeline component (sanitize + katex +
   mermaid + urlTransform), view route, renderer tests.
8. **Edit mode** — CodeMirror integration, split pane, preview toggle, debounced autosave with
   conflict handling, insert-asset-at-cursor, toasts.
9. **E2E + hardening** — Playwright specs, CSP + security headers middleware, 404/error boundaries,
   empty states, mobile layout pass.
10. **Deploy** — `wrangler secret put JWT_SECRET ASSET_COOKIE_SECRET`, remote migrations,
    `npm run deploy`, smoke-test the flow on `*.workers.dev`. Tag `v0.1.0`.

---

## Verification

```bash
npm run typecheck && npm run lint       # tsc -b across the three projects
npm test                                # both vitest projects (worker pool + jsdom)
npm run test:e2e                        # playwright against the local Worker
npm run dev                             # http://localhost:5173 — real Worker, local D1/R2
npx wrangler d1 execute mdnotes --local --command "select name from sqlite_master where type='table'"
npm run build && npx wrangler deploy --dry-run
```

Manual end-to-end check after Phase 8: guest in → project → upload a PNG and a PDF → document
referencing both by bare filename → preview shows the image, the PDF card, a rendered mermaid
diagram and a KaTeX formula → collapse the preview → reload (session survives) → sign up → confirm
the project is still listed and the asset still loads → log out → log in → same data.
