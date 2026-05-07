import { AlertTriangle, CircleAlert, CircleCheck, Users } from "lucide-react";
import { DimensionAccordion } from "./DimensionAccordion";
import { RadarChart } from "./RadarChart";
import type { FirmScore } from "../types";

interface WinsRisksState {
  wins: string[];
  risks: string[];
  loading: boolean;
  error?: string;
}

interface CompanyCardProps {
  firmScore: FirmScore;
  winsRisks: WinsRisksState | undefined;
}

function scoreColor(score: number): string {
  if (score <= 40) return "text-rose-600";
  if (score <= 65) return "text-amber-600";
  return "text-blue-600";
}

function fitLabel(score: number): { label: string; className: string } {
  if (score >= 70) return { label: "High Fit", className: "bg-blue-50 text-blue-600" };
  if (score >= 50) return { label: "Moderate Fit", className: "bg-emerald-50 text-emerald-700" };
  return { label: "Needs Work", className: "bg-rose-50 text-rose-600" };
}

export function CompanyCard({ firmScore, winsRisks }: CompanyCardProps) {
  const badge = fitLabel(firmScore.opportunityScore);
  const infoPoints = [
    { label: "Employees", value: String(firmScore.firm.fteTotal), icon: <Users className="h-3.5 w-3.5" /> },
    { label: "Revenue (FY)", value: `${(firmScore.firm.revenue / 1_000_000).toFixed(1)} Mio. EUR`, icon: <CircleCheck className="h-3.5 w-3.5" /> },
  ];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-3xl font-semibold text-slate-900">{firmScore.firm.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {firmScore.firm.digitalisierungsgrad === "Hoch" ? "Digital Tax & Automation" : "Tax & Compliance Advisory"}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
      </div>

      {firmScore.firm.warnings.length > 0 && (
        <div className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-700">
          <div className="mb-1 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold">Data warning</span>
          </div>
          {firmScore.firm.warnings.map((warning, index) => (
            <p key={`${warning.message}-${index}`}>{warning.message}</p>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <p className="text-sm text-slate-500">Opportunity Score</p>
          <div className="mt-1 flex items-end gap-1">
            <span className={`font-mono text-4xl font-semibold ${scoreColor(firmScore.opportunityScore)}`}>
              {firmScore.opportunityScore.toFixed(0)}
            </span>
            <span className="pb-1 text-sm text-slate-400">/ 100</span>
          </div>
        </div>
        <div className="space-y-1">
          {infoPoints.map((item) => (
            <p key={item.label} className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
              {item.icon}
              <span>{item.label}</span>
              <span className="font-medium text-slate-700">{item.value}</span>
            </p>
          ))}
        </div>
      </div>

      <RadarChart firmScore={firmScore} />

      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Biggest Wins</p>
          {winsRisks?.loading && <div className="mt-2 h-10 animate-pulse rounded bg-slate-100" />}
          {!winsRisks?.loading && (
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            {(winsRisks?.wins.length ? winsRisks.wins : ["LLM insight unavailable."]).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </li>
            ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Biggest Risks</p>
          {winsRisks?.loading && <div className="mt-2 h-10 animate-pulse rounded bg-slate-100" />}
          {!winsRisks?.loading && (
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            {(winsRisks?.risks.length ? winsRisks.risks : ["LLM insight unavailable."]).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span>{item}</span>
                </li>
            ))}
            </ul>
          )}
        </div>
      </div>

      {winsRisks?.error && <p className="mt-2 text-xs text-amber-600">{winsRisks.error}</p>}

      <div className="mt-4 space-y-2">
        {firmScore.dimensions.map((dimension) => (
          <DimensionAccordion key={dimension.key} dimension={dimension} />
        ))}
      </div>
    </article>
  );
}

