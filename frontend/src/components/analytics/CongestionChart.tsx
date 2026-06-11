import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface CongestionData {
  zone: string;
  congestion: number;
  train_count: number;
}

interface CongestionChartProps {
  data: CongestionData[];
}

export function CongestionChart({ data }: CongestionChartProps) {
  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <span className="control-panel-title">Zone Congestion</span>
      </div>
      <div className="control-panel-body h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3550" />
            <XAxis
              dataKey="zone"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#2a3550' }}
              tickLine={{ stroke: '#2a3550' }}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={{ stroke: '#2a3550' }}
              tickLine={{ stroke: '#2a3550' }}
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
            <Bar dataKey="congestion" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.congestion > 80
                      ? '#ef4444'
                      : entry.congestion > 50
                        ? '#eab308'
                        : '#22c55e'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
