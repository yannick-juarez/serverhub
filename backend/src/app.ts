import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config } from './config/env';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const maintenanceFlagPath = path.resolve(process.cwd(), 'storage', 'maintenance.flag');

function renderMaintenancePage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ServerHub — Mise a jour en cours</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        background: radial-gradient(1200px 800px at 20% -10%, #155e75 0%, #020617 55%);
        color: #e2e8f0;
      }
      .card {
        width: min(92vw, 680px);
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 16px;
        background: rgba(2, 6, 23, 0.7);
        backdrop-filter: blur(8px);
        padding: 28px;
      }
      h1 {
        margin: 0;
        font-size: 1.4rem;
      }
      p {
        margin: 10px 0 0;
        color: #cbd5e1;
        line-height: 1.5;
      }
      .muted {
        margin-top: 14px;
        font-size: 0.85rem;
        color: #94a3b8;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #22d3ee;
        display: inline-block;
        margin-right: 10px;
        animation: pulse 1.4s infinite;
      }
      @keyframes pulse {
        0% { transform: scale(0.9); opacity: 0.6; }
        50% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(0.9); opacity: 0.6; }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1><span class="dot"></span>Mise a jour de ServerHub en cours</h1>
      <p>
        Une operation de build est en cours. La page demandee sera disponible automatiquement
        des que la mise a jour sera terminee.
      </p>
      <p class="muted">Rechargement automatique toutes les 3 secondes...</p>
    </main>
    <script>
      setTimeout(function () {
        window.location.reload();
      }, 3000);
    </script>
  </body>
</html>`;
}

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/monitoring'),
  }),
);

// Dedicated, lenient limiter for monitoring polling endpoints
app.use(
  '/api/monitoring',
  rateLimit({
    windowMs: 60 * 1000, // 1 min
    max: 60,             // 1 req/s sustained
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ─── Parsing ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────────────────────────────
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!fs.existsSync(maintenanceFlagPath)) {
    next();
    return;
  }

  if (req.path === '/health' || req.path.startsWith('/api')) {
    next();
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(503).type('html').send(renderMaintenancePage());
    return;
  }

  next();
});

app.use('/api', router);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── Serve built frontend (production standalone mode) ────────────────────────
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback — toutes les routes non-API renvoient index.html
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

export { app };
