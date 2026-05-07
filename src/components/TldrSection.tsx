import type { FirmScore } from "../types";

interface TldrSectionProps {
  tldr: string | null;
  isLoading: boolean;
  error: string | null;
  firmScores: FirmScore[];
}

function fitLabel(score: number): string {
  if (score >= 70) return "High fit";
  if (score >= 50) return "Moderate fit";
  return "Needs work";
}

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    const isBold = part.startsWith("**") && part.endsWith("**") && part.length > 4;
    if (isBold) {
      return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

export function TldrSection({ tldr, isLoading, error, firmScores }: TldrSectionProps) {
  const sorted = [...firmScores].sort((a, b) => b.opportunityScore - a.opportunityScore);
  const topChoice = sorted[0];
  const highestUpside = sorted[0];
  const lowestRisk = [...firmScores].sort(
    (a, b) =>
      b.dimensions.find((dimension) => dimension.key === "dealAttractiveness")!.score -
      a.dimensions.find((dimension) => dimension.key === "dealAttractiveness")!.score
  )[0];
  const highestIntegrationEffort = [...firmScores].sort(
    (a, b) =>
      a.dimensions.find((dimension) => dimension.key === "integrationEase")!.score -
      b.dimensions.find((dimension) => dimension.key === "integrationEase")!.score
  )[0];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-3xl font-semibold text-slate-900">Your company decision</h2>
      <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[1.1fr_2.5fr_1fr_1fr_1fr]">
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Top Choice</p>
          <p className="mt-1 text-2xl font-semibold text-blue-700">{topChoice?.firm.name ?? "-"}</p>
          <p className="mt-1 text-xs text-slate-600">
            {topChoice ? `${fitLabel(topChoice.opportunityScore)} and strongest upside potential.` : ""}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-700">AI Summary</p>
          {isLoading && <div className="mt-2 h-14 animate-pulse rounded bg-slate-200" />}
          {!isLoading && error && <p className="mt-2 text-sm text-amber-600">{error}</p>}
          {!isLoading && !error && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {renderInlineBold(tldr ?? "Connect your OpenRouter key in .env to generate portfolio commentary.")}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">Analysis generated just now</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Highest Upside</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{highestUpside?.firm.name ?? "-"}</p>
          <p className="text-sm font-semibold text-blue-700">
            {highestUpside ? `+${(highestUpside.opportunityScore / 100).toFixed(1)} score` : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Lowest Risk</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{lowestRisk?.firm.name ?? "-"}</p>
          <p className="text-sm font-semibold text-emerald-600">Moderate</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Highest Integration Effort</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{highestIntegrationEffort?.firm.name ?? "-"}</p>
          <p className="text-sm font-semibold text-rose-600">High</p>
        </div>
      </div>
    </section>
  );
}

