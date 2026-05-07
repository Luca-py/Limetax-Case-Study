import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FirmRawData } from "../types";

const MONTHS = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const COLORS = ["#4D6EF6", "#F2645A", "#4ECFB3", "#F5A623", "#8B5CF6"];

interface SparklineChartProps {
  firms: FirmRawData[];
}

export function SparklineChart({ firms }: SparklineChartProps) {
  const data = MONTHS.map((month, index) => {
    const row: Record<string, string | number> = { month };
    firms.forEach((firm) => {
      row[firm.name] = firm.monthlyRevenue[index] ?? 0;
    });
    return row;
  });

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 10 }} />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#334155",
            }}
          />
          {firms.map((firm, index) => (
            <Line
              key={firm.name}
              type="monotone"
              dataKey={firm.name}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

