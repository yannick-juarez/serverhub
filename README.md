# ServerHub

ServerHub is a full-stack server operations panel for local or self-hosted environments.
It combines a TypeScript/Express backend with a React/Vite frontend to manage:

- authentication and user preferences
- monitoring and logs
- database and file operations
- cron jobs, services, connections, and requests

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
