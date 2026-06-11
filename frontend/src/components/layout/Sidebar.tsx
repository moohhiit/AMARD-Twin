import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrainFront,
  SquareStack,
  Route,
  TrafficCone,
  AlertTriangle,
  ClockAlert,
  Bot,
  BarChart3,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/trains', icon: TrainFront, label: 'Trains' },
  { path: '/platforms', icon: SquareStack, label: 'Platforms' },
  { path: '/routes', icon: Route, label: 'Routes' },
  { path: '/signals', icon: TrafficCone, label: 'Signals' },
  { path: '/conflicts', icon: AlertTriangle, label: 'Conflicts' },
  { path: '/delays', icon: ClockAlert, label: 'Delays' },
  { path: '/agents', icon: Bot, label: 'Agents' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-rail-panel border-r border-rail-border z-40 flex flex-col"
    >
      <div className="flex items-center gap-3 px-4 h-14 border-b border-rail-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-rail-active flex items-center justify-center shrink-0">
          <Activity className="w-4.5 h-4.5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="text-sm font-bold text-rail-text tracking-tight">RailMind AI</h1>
              <p className="text-[10px] text-rail-text-dim -mt-0.5">Railway Digital Twin</p>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-rail-text-dim hover:text-rail-text transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 relative',
                isActive
                  ? 'text-rail-active bg-rail-active-dim border border-rail-active/30'
                  : 'text-rail-text-muted hover:text-rail-text hover:bg-rail-surface'
              )}
            >
              <item.icon className={clsx('w-4.5 h-4.5 shrink-0', isActive && 'text-rail-active')} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute right-2 w-1 h-4 bg-rail-active rounded-full"
                  transition={{ duration: 0.15 }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-rail-border shrink-0">
        <div className={clsx('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <div className="w-7 h-7 rounded-full bg-rail-surface border border-rail-border flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-rail-text-muted">OP</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p className="text-xs font-medium text-rail-text">Operator</p>
                <p className="text-[10px] text-rail-text-dim -mt-0.5">Control Center</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
