import { motion } from 'framer-motion';
import { Activity, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';
import type { AgentActivity } from '@/types';

interface AgentActivityFeedProps {
  activities: AgentActivity[];
}

export function AgentActivityFeed({ activities }: AgentActivityFeedProps) {
  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <span className="control-panel-title flex items-center gap-2">
          <Activity className="w-4 h-4 text-rail-active" />
          Agent Activity
        </span>
        <span className="text-[10px] text-rail-text-muted">{activities.length} events</span>
      </div>
      <div className="max-h-[400px] overflow-y-auto scrollbar-thin divide-y divide-rail-border">
        {activities.map((activity, index) => (
          <motion.div
            key={`${activity.agent_name}-${activity.timestamp}-${index}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.02 }}
            className="p-3 flex items-start gap-3"
          >
            {activity.success ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-rail-text">
                {activity.agent_name.replace(/([A-Z])/g, ' $1').trim()}
              </p>
              <p className="text-[10px] text-rail-text-muted truncate">{activity.details}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-rail-active">{activity.event_type}</span>
                <span className="text-[9px] text-rail-text-dim">{formatDistanceToNow(activity.timestamp)}</span>
                <span className="text-[9px] font-mono text-rail-text-dim">{activity.processing_time_ms}ms</span>
              </div>
            </div>
          </motion.div>
        ))}
        {activities.length === 0 && (
          <div className="p-8 text-center text-rail-text-dim text-xs">No activity recorded</div>
        )}
      </div>
    </div>
  );
}
