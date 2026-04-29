import { useEffect, useRef } from "react";
import { connectWebSocket, disconnectWebSocket, onWebSocketMessage, type WsMessageEvent, type WsNewMessage } from "../api/websocket";
import type { ToastInput } from "./useToast";

export type NotificationOptions = {
  onNewMessage?: (message: WsNewMessage) => void;
  getCurrentConversation?: () => { type: "channel" | "direct" | "group"; id: string } | null;
  getCurrentUsername?: () => string;
  getDisplayName?: (username: string) => string;
  onToastClickMessage?: (message: WsNewMessage) => void;
};

const showNativeNotification = (title: string, body: string) => {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/icon.png",
        requireInteraction: false,
      });
    } catch (error) {
      console.error("Failed to show notification:", error);
    }
  }
};

const requestNotificationPermission = async () => {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch (error) {
    console.error("Failed to request notification permission:", error);
  }
};

export const useMessagesWebSocket = (
  workspaceId: string,
  options: NotificationOptions & {
    onShowToast?: (toast: ToastInput) => void;
  } = {},
) => {
  // Store callbacks in refs so they're always up-to-date without causing re-runs
  const optionsRef = useRef(options);
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  optionsRef.current = options;

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    connectWebSocket(workspaceId);

    const unsubscribe = onWebSocketMessage((event: WsMessageEvent) => {
      if (event.type !== "message") return;

      const message = event.payload as WsNewMessage;
      const currentConversation = optionsRef.current.getCurrentConversation?.();
      const currentUsername = optionsRef.current.getCurrentUsername?.();

      const isOtherConversation =
        !currentConversation ||
        currentConversation.id !== message.conversation_id ||
        currentConversation.type !== message.conversation_type;

      const isFromOtherUser = message.author_username?.trim().toLowerCase() !== currentUsername?.trim().toLowerCase();

      const alreadyNotified = notifiedMessageIdsRef.current.has(message.message_id);
      if (!alreadyNotified && isFromOtherUser) {
        const conversationType = message.conversation_type === "direct" ? "DM" :
          message.conversation_type === "group" ? "Group" : "Channel";
        const senderDisplayName = optionsRef.current.getDisplayName?.(message.author_username) ?? message.author_username;
        optionsRef.current.onShowToast?.({
          title: senderDisplayName,
          subtitle: message.content.slice(0, 140),
          avatarLabel: senderDisplayName,
          type: "info",
          duration: 5000,
          onClick: () => optionsRef.current.onToastClickMessage?.(message),
        });

        const shouldShowNativeNotification =
          typeof document !== "undefined"
          && (document.visibilityState !== "visible" || isOtherConversation);

        if (shouldShowNativeNotification) {
          const title = `${senderDisplayName} (${conversationType})`;
          const body = message.content.substring(0, 100);
          showNativeNotification(title, body);
        }

        notifiedMessageIdsRef.current.add(message.message_id);
        if (notifiedMessageIdsRef.current.size > 2000) {
          const first = notifiedMessageIdsRef.current.values().next();
          if (!first.done) {
            notifiedMessageIdsRef.current.delete(first.value);
          }
        }
      }

      optionsRef.current.onNewMessage?.(message);
    });

    return () => {
      // Only remove our listener — keep the WS connection alive
      unsubscribe();
    };
  // Only reconnect when workspaceId changes, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Disconnect cleanly when the component unmounts entirely
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, []);
};
