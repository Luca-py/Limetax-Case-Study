import { Plus, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyCard } from "./components/CompanyCard";
import { SettingsPanel } from "./components/SettingsPanel";
import { TldrSection } from "./components/TldrSection";
import { UploadZone } from "./components/UploadZone";
import { generateFirmWinsRisks, generatePortfolioTldr } from "./lib/openrouter";
import { parseExcel } from "./lib/parseExcel";
import { computeFirmScores, DEFAULT_DIMENSION_WEIGHTS } from "./lib/scoring";
import type { DashboardFilters, DimensionWeights, FirmRawData, FirmScore, PromptLanguage } from "./types";

type WinsRisksMap = Record<
  string,
  {
    wins: string[];
    risks: string[];
    loading: boolean;
    error?: string;
  }
>;

const DEFAULT_FILTERS: DashboardFilters = {
  minEbitdaMargin: 0,
  minFte: 0,
  digitallyReadyOnly: false,
};

function hasOpenRouterEnv(): boolean {
  return Boolean(import.meta.env.VITE_OPENROUTER_API_KEY && import.meta.env.VITE_OPENROUTER_MODEL);
}

function applyFilters(firms: FirmScore[], filters: DashboardFilters): FirmScore[] {
  return firms.filter((firm) => {
    if (firm.firm.ebitdaMargin < filters.minEbitdaMargin / 100) return false;
    if (firm.firm.fteTotal < filters.minFte) return false;
    if (filters.digitallyReadyOnly && firm.firm.digitalisierungsgrad === "Niedrig") return false;
    return true;
  });
}

function scoreHash(firm: FirmScore): string {
  return JSON.stringify({
    name: firm.firm.name,
    opportunityScore: firm.opportunityScore,
    dimensions: firm.dimensions.map((dimension) => ({ key: dimension.key, score: dimension.score })),
  });
}

export default function App() {
  const [rawFirms, setRawFirms] = useState<FirmRawData[]>([]);
  const [globalWarnings, setGlobalWarnings] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weights, setWeights] = useState<DimensionWeights>(DEFAULT_DIMENSION_WEIGHTS);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [language, setLanguage] = useState<PromptLanguage>("EN");
  const [tldr, setTldr] = useState<string | null>(null);
  const [tldrError, setTldrError] = useState<string | null>(null);
  const [tldrLoading, setTldrLoading] = useState(false);
  const [winsRisksMap, setWinsRisksMap] = useState<WinsRisksMap>({});
  const [toast, setToast] = useState<string | null>(null);
  const tldrCache = useRef<Map<string, string>>(new Map());
  const winsRisksCache = useRef<Map<string, { wins: string[]; risks: string[] }>>(new Map());

  const firmScores = useMemo(() => computeFirmScores(rawFirms, weights), [rawFirms, weights]);
  const visibleScores = useMemo(() => applyFilters(firmScores, filters), [firmScores, filters]);

  const handleUpload = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setTldr(null);
    setTldrError(null);
    setWinsRisksMap({});
    try {
      const parsed = await parseExcel(file);
      setRawFirms(parsed.firms);
      setGlobalWarnings(parsed.globalWarnings);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Failed to parse workbook.");
      setRawFirms([]);
      setGlobalWarnings([]);
    } finally {
      setIsParsing(false);
    }
  };

  useEffect(() => {
    if (!firmScores.length || !hasOpenRouterEnv()) return;

    const key = JSON.stringify({
      language,
      firms: firmScores.map((firm) => ({ name: firm.firm.name, score: firm.opportunityScore })),
    });
    const cached = tldrCache.current.get(key);
    if (cached) {
      setTldr(cached);
      return;
    }

    let cancelled = false;
    setTldrLoading(true);
    setTldrError(null);
    generatePortfolioTldr(firmScores, language)
      .then((value) => {
        if (cancelled) return;
        tldrCache.current.set(key, value);
        setTldr(value);
      })
      .catch((error) => {
        if (cancelled) return;
        setTldrError(error instanceof Error ? error.message : "Failed to generate TLDR.");
      })
      .finally(() => {
        if (!cancelled) setTldrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firmScores, language]);

  useEffect(() => {
    if (!firmScores.length || !hasOpenRouterEnv()) return;

    let cancelled = false;
    firmScores.forEach((firm) => {
      const cacheKey = `${language}:${scoreHash(firm)}`;
      const cached = winsRisksCache.current.get(cacheKey);
      if (cached) {
        setWinsRisksMap((previous) => ({
          ...previous,
          [firm.firm.name]: { ...cached, loading: false },
        }));
        return;
      }

      setWinsRisksMap((previous) => ({
        ...previous,
        [firm.firm.name]: { wins: [], risks: [], loading: true },
      }));

      generateFirmWinsRisks(firm, language)
        .then((value) => {
          if (cancelled) return;
          winsRisksCache.current.set(cacheKey, value);
          setWinsRisksMap((previous) => ({
            ...previous,
            [firm.firm.name]: { ...value, loading: false },
          }));
        })
        .catch((error) => {
          if (cancelled) return;
          setWinsRisksMap((previous) => ({
            ...previous,
            [firm.firm.name]: {
              wins: [],
              risks: [],
              loading: false,
              error: error instanceof Error ? error.message : "Failed to generate wins/risks.",
            },
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [firmScores, language]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-semibold text-slate-900">Limetax Intelligence</h1>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 pb-10 pt-6">
        {parseError && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {parseError}
          </div>
        )}

        {globalWarnings.map((warning) => (
          <div
            key={warning}
            className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-700"
          >
            {warning}
          </div>
        ))}

        {!rawFirms.length ? (
          <UploadZone onFileSelected={handleUpload} isLoading={isParsing} />
        ) : (
          <div className="space-y-6">
            <TldrSection tldr={tldr} isLoading={tldrLoading} error={tldrError} firms={rawFirms} firmScores={firmScores} />

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-3xl font-semibold text-slate-900">Company Grid</h2>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  onClick={() => {
                    setToast("Upload an Excel file with additional sheets to add companies.");
                    window.setTimeout(() => setToast(null), 2500);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add Company
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {visibleScores.map((firmScore) => (
                  <CompanyCard key={firmScore.firm.name} firmScore={firmScore} winsRisks={winsRisksMap[firmScore.firm.name]} />
                ))}
              </div>
              {!visibleScores.length && (
                <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  No firms match the current filters.
                </p>
              )}
            </section>
          </div>
        )}
      </main>

      {toast && <div className="fixed bottom-5 right-5 rounded-md bg-slate-900 px-4 py-2 text-sm text-white">{toast}</div>}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        weights={weights}
        onWeightsChange={setWeights}
        filters={filters}
        onFiltersChange={setFilters}
        language={language}
        onLanguageChange={setLanguage}
      />
    </div>
  );
}

