import { useEffect, useRef } from 'react';
import { getWebSocketService } from '@/services/websocket';
import type { EventType } from '@/types';

export function useRealtimeEvent(eventType: EventType | 'all', callback: (data: Record<string, unknown>) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const ws = getWebSocketService();
    const unsub = ws.onEvent(eventType, (payload) => {
      callbackRef.current(payload.data);
    });
    return unsub;
  }, [eventType]);
}

export function useRealtimeConnection(callback: (connected: boolean) => void) {
  useEffect(() => {
    const ws = getWebSocketService();
    const unsub = ws.onConnectionChange(callback);
    return unsub;
  }, [callback]);
}

export function useRealtimeTrainPositions() {
  useEffect(() => {
    const ws = getWebSocketService();
    ws.subscribe(['train_positions']);
    return () => ws.unsubscribe(['train_positions']);
  }, []);
}

export function useRealtimeSignalUpdates() {
  useEffect(() => {
    const ws = getWebSocketService();
    ws.subscribe(['signal_updates']);
    return () => ws.unsubscribe(['signal_updates']);
  }, []);
}

export function useRealtimeRouteChanges() {
  useEffect(() => {
    const ws = getWebSocketService();
    ws.subscribe(['route_changes']);
    return () => ws.unsubscribe(['route_changes']);
  }, []);
}

export function useRealtimePlatformOccupancy() {
  useEffect(() => {
    const ws = getWebSocketService();
    ws.subscribe(['platform_occupancy']);
    return () => ws.unsubscribe(['platform_occupancy']);
  }, []);
}

export function useRealtimeEmergencyEvents() {
  useEffect(() => {
    const ws = getWebSocketService();
    ws.subscribe(['emergency_events']);
    return () => ws.unsubscribe(['emergency_events']);
  }, []);
}

export function useRealtimeDelayUpdates() {
  useEffect(() => {
    const ws = getWebSocketService();
    ws.subscribe(['delay_updates']);
    return () => ws.unsubscribe(['delay_updates']);
  }, []);
}

export function useRealtimeAll() {
  useEffect(() => {
    const ws = getWebSocketService();
    ws.subscribe(['all']);
    return () => ws.unsubscribe(['all']);
  }, []);
}
