import { motion } from 'framer-motion';
import { Settings, Info, Server, Radio, Database } from 'lucide-react';

export default function SettingsPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-rail-active" />
        <div>
          <h1 className="text-lg font-bold text-rail-text">Settings</h1>
          <p className="text-xs text-rail-text-muted">System configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Backend Connection */}
        <div className="control-panel">
          <div className="control-panel-header">
            <span className="control-panel-title flex items-center gap-2">
              <Server className="w-4 h-4 text-rail-active" />
              Backend Connection
            </span>
          </div>
          <div className="control-panel-body space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-rail-border/50">
              <span className="text-xs text-rail-text-muted">API Base URL</span>
              <span className="text-xs font-mono text-rail-text">http://localhost:8000</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-rail-border/50">
              <span className="text-xs text-rail-text-muted">WebSocket URL</span>
              <span className="text-xs font-mono text-rail-text">ws://localhost:8000/ws/live</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-rail-text-muted">Status</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">Connected</span>
              </span>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="control-panel">
          <div className="control-panel-header">
            <span className="control-panel-title flex items-center gap-2">
              <Database className="w-4 h-4 text-rail-active" />
              Neo4j Database
            </span>
          </div>
          <div className="control-panel-body space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-rail-border/50">
              <span className="text-xs text-rail-text-muted">Type</span>
              <span className="text-xs font-mono text-rail-text">Neo4j Aura</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-rail-border/50">
              <span className="text-xs text-rail-text-muted">Driver</span>
              <span className="text-xs font-mono text-rail-text">Async Python Driver</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-rail-text-muted">Status</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">Connected</span>
              </span>
            </div>
          </div>
        </div>

        {/* Event Bus */}
        <div className="control-panel">
          <div className="control-panel-header">
            <span className="control-panel-title flex items-center gap-2">
              <Radio className="w-4 h-4 text-rail-active" />
              Event Bus
            </span>
          </div>
          <div className="control-panel-body space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-rail-border/50">
              <span className="text-xs text-rail-text-muted">Architecture</span>
              <span className="text-xs font-mono text-rail-text">Async Queue-based</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-rail-border/50">
              <span className="text-xs text-rail-text-muted">Worker Count</span>
              <span className="text-xs font-mono text-rail-text">4</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-rail-text-muted">Event Types</span>
              <span className="text-xs font-mono text-rail-text">11</span>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="control-panel">
          <div className="control-panel-header">
            <span className="control-panel-title flex items-center gap-2">
              <Info className="w-4 h-4 text-rail-active" />
              About RailMind AI
            </span>
          </div>
          <div className="control-panel-body space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-rail-border/50">
              <span className="text-xs text-rail-text-muted">Version</span>
              <span className="text-xs font-mono text-rail-text">1.0.0</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-rail-border/50">
              <span className="text-xs text-rail-text-muted">Architecture</span>
              <span className="text-xs font-mono text-rail-text">Multi-Agent Event-Driven</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-rail-text-muted">License</span>
              <span className="text-xs font-mono text-rail-text">Proprietary</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
