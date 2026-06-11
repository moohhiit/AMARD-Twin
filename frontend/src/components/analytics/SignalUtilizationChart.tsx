import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface SignalData {
  name: string;
  value: number;
  color: string;
}

interface SignalUtilizationChartProps {
  data: SignalData[];
}

export function SignalUtilizationChart({ data }: SignalUtilizationChartProps) {
  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <span className="control-panel-title">Signal Distribution</span>
      </div>
      <div className="control-panel-body h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                border: '1px solid #2a3550',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
