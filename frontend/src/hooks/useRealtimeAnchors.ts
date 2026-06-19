import { useEffect, useState, useCallback } from "react";
import { useWebSocket, WsMessage } from "./useWebSocket";
import { logger } from "@/lib/logger";
import { config } from "@/config";
import {
  isAnchorUpdate,
  isSubscriptionConfirm,
} from "@/lib/websocket-message-parser";

export interface AnchorUpdate {
  anchor_id: string;
  name: string;
  reliability_score: number;
  status: string;
}

export interface UseRealtimeAnchorsOptions {
  anchorIds?: string[];
  onAnchorUpdate?: (update: AnchorUpdate) => void;
}

export interface UseRealtimeAnchorsReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionAttempts: number;
  anchorUpdates: Map<string, AnchorUpdate>;
  subscribeToAnchors: (anchorIds: string[]) => void;
  unsubscribeFromAnchors: (anchorIds: string[]) => void;
  reconnect: () => void;
}

export function useRealtimeAnchors(
  options: UseRealtimeAnchorsOptions = {},
): UseRealtimeAnchorsReturn {
  const { anchorIds = [], onAnchorUpdate } = options;

  const [anchorUpdates, setAnchorUpdates] = useState<Map<string, AnchorUpdate>>(
    new Map(),
  );

  // Get WebSocket URL from environment or default
  const wsUrl = config.wsUrl;

  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (isAnchorUpdate(message)) {
        setAnchorUpdates((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.anchor_id, message);
          return newMap;
        });
        onAnchorUpdate?.(message);
      } else if (isSubscriptionConfirm(message)) {
        logger.debug("Anchor subscription confirmed");
      }
    },
    [onAnchorUpdate],
  );

  const {
    isConnected,
    isConnecting,
    connectionAttempts,
    subscribe,
    unsubscribe,
    reconnect,
  } = useWebSocket(wsUrl, {
    onMessage: handleMessage,
    onOpen: () => {
      logger.debug("Connected to anchor WebSocket");
      // Re-subscribe to anchors on reconnection
      if (anchorIds.length > 0) {
        subscribeToAnchors(anchorIds);
      }
    },
    onClose: () => {
      logger.debug("Disconnected from anchor WebSocket");
    },
    onError: (error) => {
      logger.error("Anchor WebSocket error:", error);
    },
  });

  const subscribeToAnchors = useCallback(
    (ids: string[]) => {
      const channels = ids.map((id) => `anchor:${id}`);
      subscribe(channels);
    },
    [subscribe],
  );

  const unsubscribeFromAnchors = useCallback(
    (ids: string[]) => {
      const channels = ids.map((id) => `anchor:${id}`);
      unsubscribe(channels);
    },
    [unsubscribe],
  );

  // Subscribe to initial anchors when connected
  useEffect(() => {
    if (isConnected && anchorIds.length > 0) {
      subscribeToAnchors(anchorIds);
    }
  }, [isConnected, anchorIds, subscribeToAnchors]);

  return {
    isConnected,
    isConnecting,
    connectionAttempts,
    anchorUpdates,
    subscribeToAnchors,
    unsubscribeFromAnchors,
    reconnect,
  };
}
