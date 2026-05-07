import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
} from "recharts";
import type { FirmScore } from "../types";

const FIRM_COLORS: Record<string, string> = {
  Bergmann: "#4D6EF6",
  Fiedler: "#F2645A",
  Nowak: "#4ECFB3",
};

interface RadarChartProps {
  firmScore: FirmScore;
}

export function RadarChart({ firmScore }: RadarChartProps) {
  const color = FIRM_COLORS[firmScore.firm.name] ?? "#4D6EF6";
  const data = firmScore.dimensions.map((dimension) => ({
    metric: dimension.name,
    value: Number(dimension.score.toFixed(2)),
  }));

  return (
    <div className="mt-2 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(148, 163, 184, 0.35)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#64748b", fontSize: 10 }} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.2} />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

