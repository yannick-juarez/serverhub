# ServerHub

ServerHub is a full-stack server operations panel for local or self-hosted environments.
It combines a TypeScript/Express backend with a React/Vite frontend to manage:

- authentication and user preferences
- monitoring and logs
- database and file operations
- cron jobs, services, connections, and requests
- Inventary: hierarchical inventories for personal storage, archives, libraries, and shops

## Monorepo Structure

```text
serverhub/
  backend/   # Express + TypeScript API
  frontend/  # React + Vite dashboard
```

## Tech Stack

### Backend

- Node.js + TypeScript
- Express
- JWT auth
- systeminformation
- MySQL (`mysql2`) and PostgreSQL (`pg`) clients
- node-cron
- WebSocket (`ws`)

### Frontend

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Axios
- React Router
- Cesium/Leaflet/Three.js tooling for visualization

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (recommended)

## Quick Start

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

Backend uses `.env` (in `backend/`) and supports the variables below.

```env
PORT=4000
NODE_ENV=development

JWT_SECRET=change_me
JWT_EXPIRES_IN=8h

ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=

PG_HOST=127.0.0.1
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=

FILES_ROOT=/var/www
CORS_ORIGINS=http://localhost:5173
```

Optional frontend environment (in `frontend/.env`):

```env
VITE_API_ORIGIN=
VITE_API_BASE_PATH=/api
```

Notes:

- leave `VITE_API_ORIGIN` empty for local dev to use the Vite proxy
- default frontend dev proxy forwards `/api` to `http://127.0.0.1:4000`

### 3. Run in development

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

Health check:

```bash
curl http://localhost:4000/health
```

## Build and Run (Production-style)

### Backend

```bash
cd backend
npm run build
npm run start
```

### Frontend

```bash
cd frontend
npm run build
npm run preview
```

## Backend API Overview

Base path: `/api`

- `/auth`
- `/monitoring`
- `/db`
- `/files`
- `/services`
- `/logs`
- `/cron`
- `/connections`
- `/requests`
- `/preferences`
- `/users`
- `/inventary`

### Inventary

Open `/inventary` from Applications or the side dock. Create a context (personal,
business, archives, or library), then nest **containers** freely: city, building,
floor, shelf, box, folder, etc. Objects/products and documents are leaf records.
Their category and notes are free text; documents are catalog records, not file uploads.

- Containers have a predefined type: **Folder**, **Box**, **Home**, **Building**,
  **Room** or **Shelf**. Choose its icon when creating or editing a container.
  The same icon is used in the tree, results, breadcrumbs, current-container empty
  state and selected-parent preview. Changing this type preserves nested contents.
  Existing containers are migrated to Folder without modifying names or hierarchy.
- Items have predefined types with reusable icons: **Object**, **Product**,
  **Document**, **Clothing** (hanger), **Book** and **Equipment**. Select a type in
  the entry editor; its icon appears in results and record details. Item types are
  also available in the type filter. Document selection retains the existing
  document entry kind; all other item types use the item kind. Existing items
  default to Object and existing documents remain Document. Stock, references,
  categories and hierarchy are unchanged by this migration.
- The Inventary interface and API messages are in English. Existing user-entered
  names, categories, notes and units are preserved.
- Select the current context using the global header dropdown (including its usage
  and private/shared visibility). The sidebar is dedicated to the container tree.
- **File** offers **New context** (`Ctrl+N`), **New container** (`Ctrl+Shift+N`)
  and **New item / document** (`N`). Use `Cmd` instead of `Ctrl` on macOS.
  The single-key shortcut is ignored while typing in fields, editable content,
  or navigating menus. New entries are placed in the open container.
- The compact app toolbar contains breadcrumbs, **Edit container** (when inside a
  container), **Container**, **Add entry**, and **Refresh**. Statistics and duplicate
  context metadata are omitted; search and the low-stock filter remain available.
- **Edit** offers **Edit container**, **Edit selected item**, **Context settings**
  and **Delete context** (with confirmation).
  Actions are disabled when there is no applicable selection, while loading/saving,
  or while a dialog is open. Context settings and deletion are restricted to the owner.
- The header reports actual loading, editing, saving, success and error states;
  success is only reported after the API confirms a mutation. Context switching
  and shortcuts are scoped to Inventary and blocked while a dialog is open.
  Idle status is hidden. The context/status group is centered using balanced side
  columns when space permits, with a wrapping layout on smaller screens.
- Contexts can be private to their creator or shared with **all authenticated
  platform users**, independently of the platform's workspace selector.
- All users with access can manage the content of a shared context. Only its
  creator can rename it, change its visibility, or delete it and its full contents.
- Entry editing also supports moving entries or entire subtrees within the same
  context. Moving across contexts is not supported. Cycles are rejected.
- Objects and documents have a nonnegative quantity, unit, low-stock threshold,
  optional SKU (unique within the context), and optional barcode stored as text
  to preserve leading zeroes. A barcode can be entered manually or with a
  keyboard-emulating scanner; camera scanning and barcode generation are not included.
- Search covers names, notes, categories, SKU, barcode, and location paths throughout
  the selected context. The low-stock filter also covers the entire context.
- Empty containers and individual records can be deleted after confirmation.
  Nonempty container deletion is blocked; deleting a context explicitly removes
  its entire hierarchy.
- Data is persisted in separate SQLite tables in the existing `storage/app.db`
  (relative to the backend working directory), without rewriting legacy storage.

Authenticated API (standard `success` / `data` / `error` / `message` envelope):

```text
GET    /api/inventary/contexts
POST   /api/inventary/contexts
PUT    /api/inventary/contexts/:contextId
DELETE /api/inventary/contexts/:contextId
GET    /api/inventary/contexts/:contextId/entries
POST   /api/inventary/contexts/:contextId/entries
PUT    /api/inventary/contexts/:contextId/entries/:entryId
DELETE /api/inventary/contexts/:contextId/entries/:entryId
POST   /api/inventary/contexts/:contextId/entries/:entryId/stock
```

Context create/update accepts `{ name, usage, visibility }`, where usage is
`personal | business | archives | library` and visibility is `private | shared`.
Entry create/update accepts the full record:
`{ parentId, kind, containerType, itemType, name, label, description, quantity, unit, minQuantity, sku, barcode }`.
`parentId` is `null` at the root; kind is `container | item | document`.
`containerType` is `folder | box | home | building | room | shelf` for containers
(omitted/null defaults to `folder` for older clients), and `null` for other entries.
`itemType` is `object | product | clothing | book | equipment` for items,
`document` for documents, and `null` for containers. Older clients may omit it
or pass `null` to use the default for the entry kind.
Containers require zero quantities and empty SKU/barcode. Stock adjustment accepts
`{ delta }` and applies it atomically; quantities and thresholds are capped at `1e12`.

Run isolated Inventary API tests without touching the runtime database:

```bash
cd backend
node --import tsx --test tests/inventary.test.ts
```

The shared header supports live app contributions through `useAppHeader` in
`frontend/src/components/Header/appHeader.ts`. `AppHeaderProvider` wraps the
authenticated layout; contributions are cleared on page unmount. Other apps retain
their manifest menus and View/fullscreen action, without sample file/save/notification
indicators.

Public endpoints:

- `GET /health`
- `POST /api/auth/login`

Authenticated endpoint example:

- `GET /api/auth/me` with `Authorization: Bearer <token>`

## Security Notes

- Default admin credentials are fallback values and must be changed in real deployments.
- Set a strong `JWT_SECRET` in non-development environments.
- Restrict `CORS_ORIGINS` to trusted frontend domains.

## Available Scripts

### backend/package.json

- `npm run dev` - run API in watch mode via `tsx`
- `npm run build` - compile TypeScript into `dist/`
- `npm run start` - run compiled API
- `npm run lint` - lint backend source

### frontend/package.json

- `npm run dev` - start Vite dev server
- `npm run build` - typecheck + production build
- `npm run preview` - preview built app
- `npm run lint` - lint frontend source

## Current Status

The repository already contains modular backend domains and a rich frontend structure.
If you want, this README can be extended with:

- endpoint-by-endpoint API docs
- contribution guidelines
- deployment examples (Docker, systemd, reverse proxy)
