import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface RiskData {
  zone: string;
  risk_score: number;
  occupancy: number;
  congestion: number;
  incident_count: number;
}

interface ZoneRiskChartProps {
  data: RiskData[];
}

export function ZoneRiskChart({ data }: ZoneRiskChartProps) {
  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <span className="control-panel-title">Zone Risk Profile</span>
      </div>
      <div className="control-panel-body h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#2a3550" />
            <PolarAngleAxis
              dataKey="zone"
              tick={{ fill: '#64748b', fontSize: 10 }}
            />
            <PolarRadiusAxis
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={{ stroke: '#2a3550' }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                border: '1px solid #2a3550',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
            />
            <Radar
              name="Risk Score"
              dataKey="risk_score"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Radar
              name="Congestion"
              dataKey="congestion"
              stroke="#eab308"
              fill="#eab308"
              fillOpacity={0.1}
              strokeWidth={1.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
