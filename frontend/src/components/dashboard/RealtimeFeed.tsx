import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrainFront,
  SquareStack,
  Route,
  TrafficCone,
  AlertTriangle,
  ClockAlert,
  Wrench,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { useEventStore } from '@/store';
import { useRealtimeEvent } from '@/hooks/useRealtimeUpdates';
import { formatDistanceToNow } from '@/lib/utils';
import type { RailwayEvent, EventType } from '@/types';

const eventTypeConfig: Record<string, { icon: typeof TrainFront; color: string; bg: string }> = {
  TRAIN_APPROACHING: { icon: TrainFront, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  PLATFORM_ASSIGNED: { icon: SquareStack, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ROUTE_ASSIGNED: { icon: Route, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ROUTE_CLEAR: { icon: Route, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ROUTE_CONFLICT: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
  SIGNAL_GREEN: { icon: TrafficCone, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  SIGNAL_RED: { icon: TrafficCone, color: 'text-red-400', bg: 'bg-red-400/10' },
  TRAIN_DELAYED: { icon: ClockAlert, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  MAINTENANCE_REQUIRED: { icon: Wrench, color: 'text-slate-400', bg: 'bg-slate-400/10' },
  EMERGENCY_TRIGGERED: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10' },
  MOVEMENT_AUTHORITY_GRANTED: { icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
};

const severityBorder: Record<string, string> = {
  CRITICAL: 'border-l-2 border-l-red-500',
  HIGH: 'border-l-2 border-l-orange-500',
  MEDIUM: 'border-l-2 border-l-amber-500',
  LOW: 'border-l-2 border-l-blue-500',
  INFO: 'border-l-2 border-l-slate-500',
};

export function RealtimeFeed() {
  const events = useEventStore((s) => s.events);
  const addEvent = useEventStore((s) => s.addEvent);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  useRealtimeEvent('all', (data) => {
    const wsEvent = data as unknown as RailwayEvent;
    if (wsEvent.event_id) {
      addEvent(wsEvent);
    }
  });

  useEffect(() => {
    if (isAutoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, isAutoScroll]);

  return (
    <div className="control-panel flex flex-col h-full max-h-[600px]">
      <div className="control-panel-header">
        <span className="control-panel-title">Live Event Feed</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-rail-text-muted">{events.length} events</span>
          </span>
          <button
            onClick={() => setIsAutoScroll(!isAutoScroll)}
            className={`text-[10px] px-1.5 py-0.5 rounded ${isAutoScroll ? 'bg-rail-active/20 text-rail-active' : 'text-rail-text-dim'}`}
          >
            Auto
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIsAutoScroll(el.scrollTop < 10);
        }}
      >
        <AnimatePresence initial={false}>
          {events.slice(0, 100).map((event) => {
            const config = eventTypeConfig[event.event_type] || eventTypeConfig.TRAIN_APPROACHING;
            const Icon = config.icon;

            return (
              <motion.div
                key={event.event_id}
                initial={{ opacity: 0, x: -8, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className={`event-item ${severityBorder[event.severity] || severityBorder.INFO} ${event.severity === 'CRITICAL' ? 'bg-red-500/5' : ''}`}
              >
                <div className={`p-1 rounded ${config.bg} shrink-0`}>
                  <Icon className={`w-3 h-3 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-rail-text truncate">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] text-rail-text-dim shrink-0">
                      {formatDistanceToNow(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-[10px] text-rail-text-muted truncate mt-0.5">
                    {event.description || event.event_type}
                  </p>
                  {event.source_train && (
                    <span className="text-[9px] font-mono text-rail-active mt-0.5">
                      {event.source_train}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-rail-text-dim">
            <p className="text-xs">No events yet</p>
            <p className="text-[10px] mt-1">Waiting for live events...</p>
          </div>
        )}
      </div>
    </div>
  );
}
