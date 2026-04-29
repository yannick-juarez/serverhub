import WebSocket from 'ws';
import http from 'http';
import url from 'url';

export type WsMessage = {
  type: 'message' | 'notification' | 'typing' | 'status';
  payload: Record<string, unknown>;
};

const wsClients = new Map<string, Set<WebSocket>>();

export const setupWebSocketServer = (server: http.Server) => {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const queryUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
    const workspaceId = queryUrl.searchParams.get('workspace');

    if (!workspaceId) {
      ws.close(1008, 'Missing workspace parameter');
      return;
    }

    // Add client to workspace group
    if (!wsClients.has(workspaceId)) {
      wsClients.set(workspaceId, new Set());
    }
    wsClients.get(workspaceId)?.add(ws);

    console.log(`[WebSocket] Client connected to workspace '${workspaceId}'`);

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString()) as WsMessage;
        // Handle incoming messages from client if needed
        console.log(`[WebSocket] Message received:`, message.type);
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      wsClients.get(workspaceId)?.delete(ws);
      if (wsClients.get(workspaceId)?.size === 0) {
        wsClients.delete(workspaceId);
      }
      console.log(`[WebSocket] Client disconnected from workspace '${workspaceId}'`);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
    });
  });

  // Handle upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '', `http://${request.headers.host}`).pathname;

    if (pathname === '/api/messages/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  return { wss, broadcastMessage };
};

export const broadcastMessage = (
  workspaceId: string,
  message: WsMessage,
) => {
  const clients = wsClients.get(workspaceId);
  if (!clients) return;

  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, (error) => {
        if (error) {
          console.error('[WebSocket] Error sending message:', error);
        }
      });
    }
  });
};

export const broadcastNewMessage = (
  workspaceId: string,
  message: {
    message_id: string;
    conversation_type: 'channel' | 'direct' | 'group';
    conversation_id: string;
    author_user_id: string;
    author_username: string;
    content: string;
    created_at: string;
    updated_at: string;
  },
) => {
  broadcastMessage(workspaceId, {
    type: 'message',
    payload: message,
  });
};
