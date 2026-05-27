# flightops-web

Next.js 14 frontend for Peregrine FlightOps.

## Stack

Next.js App Router · TypeScript · Tailwind CSS · shadcn/ui (lucide-react) · React Query + Zustand (added M1-G-4) · next-auth (added M1-G-5) · Vitest + Playwright (added M1-G-7)

## Quick start

```bash
cp .env.example .env.local
# edit .env.local — pick one of the three NEXT_PUBLIC_API_URL modes

npm install
npm run dev
```

Open http://localhost:3000.

## Three backend modes (`NEXT_PUBLIC_API_URL`)

| Mode | When | URL example |
|---|---|---|
| Local Docker via LAN | Marc and Greg on same network | `http://192.168.1.42:8000` |
| Cloudflare Tunnel | Remote collab while Marc runs `docker compose up` | `https://shy-mountain-xxxx.trycloudflare.com` |
| Render staging | Greg solo, Marc offline | `https://flightops-gateway-staging.onrender.com` |

Mode is just an `.env.local` change — no code edits.

## Scripts

- `npm run dev` — local dev server with HMR
- `npm run build` — production build (used by Vercel)
- `npm run start` — serve the production build
- `npm run lint` — ESLint
- `npm run type-check` — `tsc --noEmit`
- `npm test` — Vitest unit + component tests (includes a11y assertions)
- `npm run test:e2e` — Playwright e2e against a running local stack

## Accessibility

We enforce WCAG 2.0 A + AA via vitest at the component level (CI-gated) and Playwright at the page level (local/pre-merge). See [ACCESSIBILITY.md](ACCESSIBILITY.md) for the rules and how to add coverage for a new component or page.

## SSO providers (scaffold)

The login page and Auth.js are wired for Google, Microsoft Entra ID, and Okta. Each provider activates the moment both of its env vars are set — no code changes needed.

| Provider | Env vars required (both must be set) |
|---|---|
| Google | `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` |
| Microsoft Entra ID | `AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID`, `AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET` |
| Okta | `AUTH_OKTA_CLIENT_ID`, `AUTH_OKTA_CLIENT_SECRET` |

When a provider's env vars are set in **both** the web env (Vercel) and the backend env (Render) it appears as a "Sign in with …" button on the login page. The backend reports its enabled providers at `GET /auth/providers`, which the login page fetches server-side.

**Provisioning rule:** SSO does not auto-create users. If `pilot@acme.com` signs in via Google but doesn't exist in our `users` table, the backend rejects with `403 user_not_provisioned`. An admin must invite/create the user first.

## Deploys

- **Production**: pushes to `main` → Vercel auto-deploys to `flightops-web.vercel.app`
- **Preview**: every PR gets a unique URL like `flightops-web-pr-42.vercel.app`
- **Backend target** for preview deploys: Render staging (set via `NEXT_PUBLIC_API_URL` in Vercel env vars)

## Story map

This scaffold delivers M1-G-2. Subsequent Month 1 stories add:
- M1-G-3: shared component library + Storybook
- M1-G-4: API client + React Query + Zustand
- M1-G-5: next-auth + SSO scaffolding
- M1-G-6: tenant context + org switcher
- M1-G-7: Vitest + Playwright + axe-core
- M1-G-10: Dispatch page
- M1-G-11: 6 Dashboard views
- M1-G-12: Home page (real, replaces this placeholder)

See [PLAN.md](../PLAN.md) for the full milestone breakdown.
