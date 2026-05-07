import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DimensionScore } from "../types";

interface DimensionAccordionProps {
  dimension: DimensionScore;
}

function scoreColor(score: number): string {
  if (score >= 7) return "text-blue-600";
  if (score >= 4) return "text-slate-600";
  return "text-rose-600";
}

export function DimensionAccordion({ dimension }: DimensionAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {dimension.name}
        </span>
        <span className={`font-mono text-sm font-semibold ${scoreColor(dimension.score)}`}>{dimension.score.toFixed(1)} / 10</span>
      </button>
      {open && (
        <div className="overflow-hidden border-t border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left">Metric</th>
                <th className="px-3 py-2 text-left">Raw Value</th>
                <th className="px-3 py-2 text-left">Score</th>
              </tr>
            </thead>
            <tbody>
              {dimension.metrics.map((metric) => (
                <tr key={metric.label} className="border-t border-slate-100 text-slate-600">
                  <td className="px-3 py-2">{metric.label}</td>
                  <td className="px-3 py-2">{metric.rawValue}</td>
                  <td className="px-3 py-2 font-mono">
                    {metric.score.toFixed(1)}{" "}
                    <span className={metric.higherIsBetter ? "text-emerald-600" : "text-rose-600"}>
                      {metric.higherIsBetter ? "↑" : "↓"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

