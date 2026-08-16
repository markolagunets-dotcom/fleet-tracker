'use client';

import type { Telemetry } from '@fleet-tracker/shared';
import {
  parseServerMessage,
  PROTOCOL_MISMATCH_CODE,
  PROTOCOL_VERSION,
  PROTOCOL_VERSION_PARAM,
} from '@fleet-tracker/shared';
import {
  PANEL_INTERVAL_MS,
  WS_RECONNECT_MAX_MS,
  WS_RECONNECT_MIN_MS,
} from '@/lib/constants';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { WS_URL } from '@/lib/config';
import { queryKeys } from './useQueries';

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  /** The server speaks a different wire format — reconnecting cannot fix this. */
  | 'outdated';

/**
 * Subscribes to the telemetry socket.
 *
 * `onPoints` is called for every frame (5 Hz) and is expected to write directly into
 * an imperative renderer. React Query only receives a throttled snapshot at
 * PANEL_HZ, because pushing 5 Hz through the cache would re-render every subscriber
 * five times a second and copy a growing array each time.
 */
export function useTelemetryStream(onPoints: (points: Telemetry[]) => void): ConnectionState {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  // Kept in an effect rather than assigned during render: the socket callbacks read
  // this after commit, so a post-render write is soon enough and keeps render pure.
  const onPointsRef = useRef(onPoints);
  useEffect(() => {
    onPointsRef.current = onPoints;
  }, [onPoints]);

  const lastPanelPush = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let backoff = WS_RECONNECT_MIN_MS;
    let closedByUnmount = false;

    const connect = (): void => {
      // The handshake carries the wire version so the server can refuse a stale tab
      // rather than let it mis-render a payload it does not understand.
      const url = new URL(WS_URL);
      url.searchParams.set(PROTOCOL_VERSION_PARAM, String(PROTOCOL_VERSION));
      socket = new WebSocket(url);

      socket.onopen = () => {
        backoff = WS_RECONNECT_MIN_MS;
        setConnection('connected');
        // A client that was away must not draw the gap as a straight line.
        void queryClient.invalidateQueries({ queryKey: queryKeys.history });
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        // Validated, not cast: a renamed or missing field must drop the frame
        // rather than reach the imperative renderer.
        const message = parseServerMessage(event.data);
        if (!message) {
          console.warn('[fleet-tracker] dropped an invalid frame');
          return;
        }

        if (message.type === 'tick') {
          onPointsRef.current(message.points);

          const now = Date.now();
          if (now - lastPanelPush.current >= PANEL_INTERVAL_MS) {
            lastPanelPush.current = now;
            queryClient.setQueryData(queryKeys.latest, message.points);
          }
          return;
        }

        if (message.type === 'flightEnded') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.flights });
          void queryClient.invalidateQueries({ queryKey: queryKeys.history });
        }
      };

      socket.onclose = (event: CloseEvent) => {
        if (closedByUnmount) {
          return;
        }

        // Retrying would just be refused again; the page has to reload to pick up a
        // bundle that speaks the server's version.
        if (event.code === PROTOCOL_MISMATCH_CODE) {
          console.warn('[fleet-tracker] protocol mismatch — reload required');
          setConnection('outdated');
          return;
        }
        setConnection(backoff >= WS_RECONNECT_MAX_MS ? 'offline' : 'reconnecting');
        retryTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, WS_RECONNECT_MAX_MS);
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      closedByUnmount = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      socket?.close();
    };
  }, [queryClient]);

  return connection;
}
