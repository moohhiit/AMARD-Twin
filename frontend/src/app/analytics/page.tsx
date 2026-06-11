import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { useNetworkStateQuery } from '@/hooks/useNetworkState';
import { CongestionChart } from '@/components/analytics/CongestionChart';
import { ZoneRiskChart } from '@/components/analytics/ZoneRiskChart';
import { SignalUtilizationChart } from '@/components/analytics/SignalUtilizationChart';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';

export default function AnalyticsPage() {
  const { data: networkState, isLoading, error, refetch } = useNetworkStateQuery(5000);

  const congestionData = (networkState?.zones || []).map((z) => ({
    zone: z.name || z.zone_id,
    congestion: Math.round(z.congestion_level * 100),
    train_count: z.occupancy_level,
  }));

  const riskData = (networkState?.zones || []).map((z) => ({
    zone: z.name || z.zone_id,
    risk_score: Math.round(z.risk_score * 100),
    occupancy: Math.round(z.occupancy_level * 100),
    congestion: Math.round(z.congestion_level * 100),
    incident_count: Math.round(z.risk_score * 10),
  }));

  const signalData = [
    { name: 'GREEN', value: networkState?.signals?.filter((s) => s.state === 'GREEN').length || 0, color: '#22c55e' },
    { name: 'RED', value: networkState?.signals?.filter((s) => s.state === 'RED').length || 0, color: '#ef4444' },
    { name: 'YELLOW', value: networkState?.signals?.filter((s) => s.state === 'YELLOW').length || 0, color: '#eab308' },
    { name: 'FLASHING', value: networkState?.signals?.filter((s) => s.state === 'FLASHING').length || 0, color: '#f97316' },
  ].filter((d) => d.value > 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-rail-active" />
        <div>
          <h1 className="text-lg font-bold text-rail-text">Analytics</h1>
          <p className="text-xs text-rail-text-muted">Digital twin analytics and insights</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState fullPage />
      ) : error ? (
        <ErrorState message="Failed to load analytics" onRetry={refetch} fullPage />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CongestionChart data={congestionData} />
          <ZoneRiskChart data={riskData} />
          <SignalUtilizationChart data={signalData} />
          <div className="control-panel">
            <div className="control-panel-header">
              <span className="control-panel-title">Train Status Distribution</span>
            </div>
            <div className="control-panel-body h-[250px]">
              {/* Bar chart for train status */}
              <StatusBarChart trains={networkState?.trains || []} />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function StatusBarChart({ trains }: { trains: Array<{ status: string }> }) {
  const statusCounts = trains.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    color:
      status === 'RUNNING' ? '#22c55e' :
      status === 'DELAYED' ? '#eab308' :
      status === 'STOPPED' ? '#64748b' :
      status === 'EMERGENCY' ? '#ef4444' :
      status === 'APPROACHING' ? '#3b82f6' :
      '#64748b',
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3550" />
        <XAxis dataKey="status" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#2a3550' }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#2a3550' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#111827',
            border: '1px solid #2a3550',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#e2e8f0',
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
