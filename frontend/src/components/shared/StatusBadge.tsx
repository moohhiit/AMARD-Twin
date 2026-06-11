import { clsx } from 'clsx';

type StatusVariant = 'running' | 'delayed' | 'emergency' | 'stopped' | 'approaching' | 'maintenance' |
  'available' | 'reserved' | 'occupied' | 'free' |
  'green' | 'red' | 'yellow' | 'flashing' | 'off' |
  'critical' | 'high' | 'medium' | 'low' | 'info' |
  'healthy' | 'degraded' | 'error';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const variantStyles: Record<StatusVariant, { dot: string; bg: string; text: string }> = {
  running: { dot: 'bg-train-running', bg: 'bg-train-running/10', text: 'text-train-running' },
  delayed: { dot: 'bg-train-delayed', bg: 'bg-train-delayed/10', text: 'text-train-delayed' },
  emergency: { dot: 'bg-train-emergency', bg: 'bg-train-emergency/10', text: 'text-train-emergency' },
  stopped: { dot: 'bg-train-stopped', bg: 'bg-train-stopped/10', text: 'text-train-stopped' },
  approaching: { dot: 'bg-train-approaching', bg: 'bg-train-approaching/10', text: 'text-train-approaching' },
  maintenance: { dot: 'bg-train-stopped', bg: 'bg-train-stopped/10', text: 'text-train-stopped' },
  available: { dot: 'bg-status-available', bg: 'bg-status-available/10', text: 'text-status-available' },
  free: { dot: 'bg-status-available', bg: 'bg-status-available/10', text: 'text-status-available' },
  reserved: { dot: 'bg-status-reserved', bg: 'bg-status-reserved/10', text: 'text-status-reserved' },
  occupied: { dot: 'bg-status-occupied', bg: 'bg-status-occupied/10', text: 'text-status-occupied' },
  green: { dot: 'bg-signal-green', bg: 'bg-signal-green/10', text: 'text-signal-green' },
  red: { dot: 'bg-signal-red', bg: 'bg-signal-red/10', text: 'text-signal-red' },
  yellow: { dot: 'bg-signal-yellow', bg: 'bg-signal-yellow/10', text: 'text-signal-yellow' },
  flashing: { dot: 'bg-signal-flashing', bg: 'bg-signal-flashing/10', text: 'text-signal-flashing' },
  off: { dot: 'bg-rail-text-dim', bg: 'bg-rail-text-dim/10', text: 'text-rail-text-dim' },
  critical: { dot: 'bg-severity-critical', bg: 'bg-severity-critical/10', text: 'text-severity-critical' },
  high: { dot: 'bg-severity-high', bg: 'bg-severity-high/10', text: 'text-severity-high' },
  medium: { dot: 'bg-severity-medium', bg: 'bg-severity-medium/10', text: 'text-severity-medium' },
  low: { dot: 'bg-severity-low', bg: 'bg-severity-low/10', text: 'text-severity-low' },
  info: { dot: 'bg-rail-active', bg: 'bg-rail-active/10', text: 'text-rail-active' },
  healthy: { dot: 'bg-signal-green', bg: 'bg-signal-green/10', text: 'text-signal-green' },
  degraded: { dot: 'bg-signal-yellow', bg: 'bg-signal-yellow/10', text: 'text-signal-yellow' },
  error: { dot: 'bg-signal-red', bg: 'bg-signal-red/10', text: 'text-signal-red' },
};

function normalizeStatus(status: string): StatusVariant {
  const s = status.toLowerCase();
  return (s as StatusVariant) in variantStyles ? (s as StatusVariant) : 'info';
}

export function StatusBadge({ status, variant, size = 'sm', pulse = false }: StatusBadgeProps) {
  const v = variant || normalizeStatus(status);
  const styles = variantStyles[v] || variantStyles.info;

  return (
    <span className={clsx('status-badge', styles.bg, styles.text, size === 'md' && 'text-sm px-2.5 py-1')}>
      <span className={clsx('status-dot', styles.dot, pulse && 'animate-pulse-signal')} />
      {status}
    </span>
  );
}
