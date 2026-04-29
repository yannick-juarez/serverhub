export type WsMessageEvent = {
  type: "message" | "notification" | "typing" | "status";
  payload: Record<string, unknown>;
};

export type WsNewMessage = {
  message_id: string;
  workspace_id: string;
  conversation_type: "channel" | "direct" | "group";
  conversation_id: string;
  author_user_id: string;
  author_username: string;
  content: string;
  created_at: string;
  updated_at: string;
};

let ws: WebSocket | null = null;
const listeners = new Set<(event: WsMessageEvent) => void>();
const reconnectIntervals = [1000, 2000, 5000, 10000];
let reconnectAttempt = 0;

const getWsUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  // Adjust the path based on your backend WebSocket endpoint
  return `${protocol}//${host}/api/messages/ws`;
};

export const connectWebSocket = (workspaceId: string) => {
  // Guard against both OPEN and CONNECTING states
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
    return;
  }

  try {
    const url = new URL(getWsUrl());
    url.searchParams.set("workspace", workspaceId);
    
    ws = new WebSocket(url.toString());
    console.log("[WS] Connecting to", url.toString());

    ws.addEventListener("open", () => {
      console.log("✓ WebSocket connected");
      reconnectAttempt = 0;
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessageEvent;
        listeners.forEach((listener) => listener(data));
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    });

    ws.addEventListener("close", (event) => {
      console.log(`✗ WebSocket disconnected (code ${event.code})`);
      ws = null;
      // Only reconnect on abnormal closure
      if (event.code !== 1000) {
        scheduleReconnect(workspaceId);
      }
    });

    ws.addEventListener("error", () => {
      console.error("WebSocket error — will reconnect after close");
    });
  } catch (error) {
    console.error("Failed to connect WebSocket:", error);
    scheduleReconnect(workspaceId);
  }
};

const scheduleReconnect = (workspaceId: string) => {
  const delay = reconnectIntervals[Math.min(reconnectAttempt, reconnectIntervals.length - 1)];
  reconnectAttempt++;
  
  setTimeout(() => {
    connectWebSocket(workspaceId);
  }, delay);
};

export const disconnectWebSocket = () => {
  if (ws) {
    ws.close();
    ws = null;
  }
  listeners.clear();
};

export const onWebSocketMessage = (listener: (event: WsMessageEvent) => void) => {
  listeners.add(listener);
  
  return () => {
    listeners.delete(listener);
  };
};
