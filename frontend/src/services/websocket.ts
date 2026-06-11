import type { WebSocketMessage, WebSocketEventPayload, EventType } from '@/types';

export type WebSocketTopic =
  | 'train_positions'
  | 'route_changes'
  | 'platform_occupancy'
  | 'delay_updates'
  | 'signal_updates'
  | 'emergency_events'
  | 'all';

const WS_URL = 'ws://localhost:8000/ws/live';

const EVENT_TYPE_TO_TOPIC: Record<EventType, WebSocketTopic> = {
  TRAIN_APPROACHING: 'train_positions',
  MOVEMENT_AUTHORITY_GRANTED: 'train_positions',
  ROUTE_ASSIGNED: 'route_changes',
  ROUTE_CLEAR: 'route_changes',
  PLATFORM_ASSIGNED: 'platform_occupancy',
  TRAIN_DELAYED: 'delay_updates',
  SIGNAL_GREEN: 'signal_updates',
  SIGNAL_RED: 'signal_updates',
  EMERGENCY_TRIGGERED: 'emergency_events',
  ROUTE_CONFLICT: 'emergency_events',
  MAINTENANCE_REQUIRED: 'emergency_events',
};

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private subscribedTopics: Set<WebSocketTopic> = new Set();
  private listeners: Map<string, Set<(payload: WebSocketEventPayload) => void>> = new Map();
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private connected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(WS_URL);
      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.notifyStatusListeners(true);
        if (this.subscribedTopics.size > 0) {
          this.send({
            action: 'subscribe',
            topics: Array.from(this.subscribedTopics),
          });
        }
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload: WebSocketEventPayload = JSON.parse(event.data);
          this.handlePayload(payload);
        } catch {
          // ignore non-JSON messages
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.notifyStatusListeners(false);
        this.stopPing();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connected = false;
        this.notifyStatusListeners(false);
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      this.send({ action: 'ping' });
    }, 30000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handlePayload(payload: WebSocketEventPayload) {
    const topic = payload.event_type ? EVENT_TYPE_TO_TOPIC[payload.event_type] : null;
    if (topic) {
      this.notifyListeners(topic, payload);
    }
    this.notifyListeners('all', payload);
  }

  private notifyListeners(topic: string, payload: WebSocketEventPayload) {
    const listeners = this.listeners.get(topic);
    if (listeners) {
      listeners.forEach((cb) => cb(payload));
    }
  }

  private notifyStatusListeners(connected: boolean) {
    this.statusListeners.forEach((cb) => cb(connected));
  }

  subscribe(topics: WebSocketTopic[]) {
    topics.forEach((t) => this.subscribedTopics.add(t));
    this.send({ action: 'subscribe', topics });
  }

  unsubscribe(topics: WebSocketTopic[]) {
    topics.forEach((t) => this.subscribedTopics.delete(t));
    this.send({ action: 'unsubscribe', topics });
  }

  onEvent(eventType: EventType | 'all', callback: (payload: WebSocketEventPayload) => void) {
    const topic = eventType === 'all' ? 'all' : EVENT_TYPE_TO_TOPIC[eventType];
    if (!topic) return () => {};
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    this.listeners.get(topic)!.add(callback);
    this.subscribe([topic]);
    return () => {
      this.listeners.get(topic)?.delete(callback);
    };
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.statusListeners.add(callback);
    callback(this.connected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  isConnected() {
    return this.connected;
  }

  disconnect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

let wsInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!wsInstance) {
    wsInstance = new WebSocketService();
  }
  return wsInstance;
}

export function resetWebSocketService() {
  if (wsInstance) {
    wsInstance.disconnect();
    wsInstance = null;
  }
}
