import { X } from "lucide-react";
import type { DashboardFilters, DimensionWeights, DimensionKey, PromptLanguage } from "../types";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  weights: DimensionWeights;
  onWeightsChange: (weights: DimensionWeights) => void;
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  language: PromptLanguage;
  onLanguageChange: (language: PromptLanguage) => void;
}

const weightLabels: Array<{ key: DimensionKey; label: string }> = [
  { key: "optimizationLeverage", label: "Room for Improvement" },
  { key: "integrationEase", label: "Integration Complexity" },
  { key: "growthPlatform", label: "Growth Potential" },
  { key: "dealAttractiveness", label: "Acquisition Appeal" },
];

function redistributeWeights(
  current: DimensionWeights,
  key: DimensionKey,
  rawValue: number
): DimensionWeights {
  const nextValue = Math.min(100, Math.max(0, Math.round(rawValue)));
  const keys = Object.keys(current) as DimensionKey[];
  const otherKeys = keys.filter((item) => item !== key);
  const remaining = 100 - nextValue;
  const otherTotal = otherKeys.reduce((sum, item) => sum + current[item], 0);

  const next: DimensionWeights = { ...current, [key]: nextValue };
  if (otherKeys.length === 0) return next;

  if (otherTotal <= 0) {
    const base = Math.floor(remaining / otherKeys.length);
    let leftovers = remaining - base * otherKeys.length;
    otherKeys.forEach((item) => {
      next[item] = base + (leftovers > 0 ? 1 : 0);
      leftovers -= 1;
    });
    return next;
  }

  let assigned = 0;
  otherKeys.forEach((item, index) => {
    if (index === otherKeys.length - 1) {
      next[item] = remaining - assigned;
      return;
    }
    const proportional = Math.round((current[item] / otherTotal) * remaining);
    next[item] = proportional;
    assigned += proportional;
  });

  return next;
}

export function SettingsPanel({
  open,
  onClose,
  weights,
  onWeightsChange,
  filters,
  onFiltersChange,
  language,
  onLanguageChange,
}: SettingsPanelProps) {
  return (
    <aside
      className={`fixed right-0 top-0 z-30 h-full w-full max-w-md border-l border-slate-200 bg-white p-5 shadow-xl transition-transform ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Dimension Weights</h3>
          <div className="mt-3 space-y-3">
            {weightLabels.map(({ key, label }) => (
              <label key={key} className="block">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{label}</span>
                  <span className="font-mono">{weights[key]}%</span>
                </div>
                <input
                  className="w-full accent-blue-600"
                  type="range"
                  min={0}
                  max={100}
                  value={weights[key]}
                  onChange={(event) => onWeightsChange(redistributeWeights(weights, key, Number(event.target.value)))}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-800">Thresholds / Filters</h3>
          <div className="mt-3 space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-slate-600">Minimum EBITDA margin (%)</span>
              <input
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-700"
                type="number"
                min={0}
                value={filters.minEbitdaMargin}
                onChange={(event) =>
                  onFiltersChange({ ...filters, minEbitdaMargin: Math.max(0, Number(event.target.value)) })
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-slate-600">Minimum company size (FTE)</span>
              <input
                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-700"
                type="number"
                min={0}
                value={filters.minFte}
                onChange={(event) => onFiltersChange({ ...filters, minFte: Math.max(0, Number(event.target.value)) })}
              />
            </label>
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                checked={filters.digitallyReadyOnly}
                onChange={(event) => onFiltersChange({ ...filters, digitallyReadyOnly: event.target.checked })}
              />
              Only show digitally-ready firms
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-800">Display Language (LLM)</h3>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onLanguageChange("EN")}
              className={`rounded px-3 py-1 text-sm ${language === "EN" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange("DE")}
              className={`rounded px-3 py-1 text-sm ${language === "DE" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              DE
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

