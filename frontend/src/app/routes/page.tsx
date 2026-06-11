import { motion } from 'framer-motion';
import { Route } from 'lucide-react';
import { RouteVisualizer } from '@/components/routes/RouteVisualizer';

export default function RoutesPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <Route className="w-5 h-5 text-rail-active" />
        <div>
          <h1 className="text-lg font-bold text-rail-text">Routes</h1>
          <p className="text-xs text-rail-text-muted">Route planning and visualization</p>
        </div>
      </div>
      <RouteVisualizer />
    </motion.div>
  );
}
