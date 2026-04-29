# Project Guidelines

## Code Style
- Keep changes scoped to either `backend/` or `frontend/`; avoid cross-cutting rewrites unless the task requires both.
- Preserve the existing layered backend pattern: routes -> controller -> service.
- Keep backend responses aligned with the `ApiResponse<T>` envelope shape (`success`, `data`, `error`, `message`).
- Use TypeScript types explicitly. In frontend, assume strict TS checks (`noUnusedLocals`, `noUnusedParameters`) are enforced by build/lint.
- Reuse existing frontend API helpers in `frontend/src/api/` and config from `frontend/src/config/api.ts` instead of hardcoding URLs.

## Architecture
- Monorepo layout:
  - `backend/`: Express + TypeScript API with module folders under `backend/src/modules/*`.
  - `frontend/`: React + Vite app with route/page/component code under `frontend/src/` and app manifests under `frontend/src/apps/*`.
- Backend composition:
  - App/bootstrap in `backend/src/app.ts`.
  - API router aggregation in `backend/src/routes/index.ts` mounted under `/api`.
  - Auth and error flow through middleware in `backend/src/middleware/*`.
- Frontend composition:
  - Route/layout shell in `frontend/src/App.tsx` and `frontend/src/components/ProtectedRoute.tsx`.
  - HTTP requests primarily through `frontend/src/api/http.ts` and feature clients in `frontend/src/api/*`.

## Build and Test
- Install dependencies per package:
  - `cd backend && npm install`
  - `cd frontend && npm install`
- Quick package-scoped checks (preferred for small changes):
  - `npm --prefix backend run lint && npm --prefix backend run build`
  - `npm --prefix frontend run lint && npm --prefix frontend run build`
- Backend commands:
  - `cd backend && npm run dev`
  - `cd backend && npm run build`
  - `cd backend && npm run lint`
- Frontend commands:
  - `cd frontend && npm run dev`
  - `cd frontend && npm run build`
  - `cd frontend && npm run lint`
- There is no dedicated test suite configured yet. Prefer running both lint and build checks for changed package(s) before finalizing work.

## Conventions
- Protect non-public backend endpoints with auth middleware and keep async route handlers wrapped by `asyncHandler`.
- Put domain logic in services; controllers should focus on request validation and HTTP response mapping.
- For frontend auth behavior, align with existing cookie-based token flow (`token` cookie) and unauthorized redirect handling.
- Keep API base-path assumptions consistent with Vite proxy (`/api` -> `http://127.0.0.1:4000`) unless task explicitly changes environment behavior.
- Prefer `frontend/src/api/http.ts` + feature API clients for new frontend API calls; do not introduce additional HTTP client patterns.

## Pitfalls
- Backend defaults include fallback secrets/credentials in `backend/src/config/env.ts`; do not rely on defaults for production-oriented changes.
- Backend auth currently allows fallback `.env` admin login in `backend/src/modules/auth/auth.service.ts` when user storage does not provide a matching account.
- Backend storage currently depends on process working directory (`storage/app-storage.json`); avoid changes that silently shift runtime cwd assumptions.
- Frontend currently mixes `fetch` wrapper usage with a direct `axios` login call in `frontend/src/pages/Login.tsx`; avoid introducing a third request pattern.
- Frontend build includes heavier libs (Cesium/Three). Prefer lazy-loading or scoped imports for new heavy UI features.
