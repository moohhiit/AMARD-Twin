import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistanceToNow(date: Date | string | number): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString();
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function formatSpeed(kmh: number): string {
  return `${Math.round(kmh)} km/h`;
}

export function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('running') || s.includes('green') || s.includes('available') || s.includes('free')) return 'text-emerald-400';
  if (s.includes('delayed') || s.includes('yellow') || s.includes('reserved')) return 'text-amber-400';
  if (s.includes('emergency') || s.includes('red') || s.includes('occupied') || s.includes('critical')) return 'text-red-400';
  if (s.includes('stopped') || s.includes('gray') || s.includes('off') || s.includes('maintenance')) return 'text-slate-400';
  if (s.includes('approaching') || s.includes('blue')) return 'text-blue-400';
  return 'text-slate-400';
}
