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
    skip: (req) => req.path.startsWith('/api/monitoring'),
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
