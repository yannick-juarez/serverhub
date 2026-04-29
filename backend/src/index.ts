import http from 'http';
import { app } from './app';
import { config } from './config/env';
import { setupWebSocketServer } from './middleware/websocket';

const server = http.createServer(app);

// Setup WebSocket server
setupWebSocketServer(server);

server.listen(config.port, () => {
  console.log(`[ServerHub] Running on http://localhost:${config.port} (${config.nodeEnv})`);
});

server.on('error', (err) => {
  console.error('[ServerHub] Server error:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[ServerHub] SIGTERM received – shutting down gracefully');
  server.close(() => process.exit(0));
});
