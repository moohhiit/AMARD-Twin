import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  delay?: number;
  onClick?: () => void;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
    text: 'text-blue-400',
  },
  green: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
    text: 'text-emerald-400',
  },
  yellow: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
    text: 'text-amber-400',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: 'text-red-400',
    text: 'text-red-400',
  },
  gray: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    icon: 'text-slate-400',
    text: 'text-slate-400',
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
  trend,
  trendValue,
  delay = 0,
  onClick,
}: MetricCardProps) {
  const colors = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: delay * 0.05 }}
      onClick={onClick}
      className={clsx(
        'control-panel p-4 cursor-default',
        onClick && 'hover:border-rail-active/30 transition-colors cursor-pointer',
        colors.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className={clsx('p-2 rounded-lg', colors.bg)}>
          <span className={colors.icon}>{icon}</span>
        </div>
        {trend && trendValue && (
          <span
            className={clsx(
              'text-xs font-medium',
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-rail-text-dim'
            )}
          >
            {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
            {trendValue}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs text-rail-text-muted uppercase tracking-wider">{title}</p>
        <p className="metric-value text-rail-text mt-1">{value}</p>
        {subtitle && <p className="text-xs text-rail-text-dim mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}
