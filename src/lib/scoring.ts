import type {
  DimensionKey,
  DimensionScore,
  DimensionWeights,
  FirmRawData,
  FirmScore,
  MetricScore,
} from "../types";

interface MetricSpec {
  label: string;
  weight: number;
  higherIsBetter: boolean;
  valueGetter: (firm: FirmRawData) => number | undefined;
  rawFormatter: (firm: FirmRawData) => string;
  fixedScore?: (firm: FirmRawData) => number | undefined;
}

const DIMENSION_NAMES: Record<DimensionKey, string> = {
  optimizationLeverage: "Optimization Leverage",
  integrationEase: "Integration Ease",
  growthPlatform: "Growth Platform",
  dealAttractiveness: "Deal Attractiveness",
};

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  optimizationLeverage: 35,
  integrationEase: 30,
  growthPlatform: 20,
  dealAttractiveness: 15,
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function normalizeMetric(values: Array<number | undefined>, index: number, higherIsBetter: boolean): number | undefined {
  const current = values[index];
  if (current == null) return undefined;

  const valid = values.filter((value): value is number => value != null);
  if (valid.length <= 1) return 5;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return 5;

  const base = ((current - min) / (max - min)) * 10;
  const score = higherIsBetter ? base : 10 - base;
  return Math.min(10, Math.max(0, score));
}

function computeDimension(
  firms: FirmRawData[],
  specs: MetricSpec[],
  dimensionKey: DimensionKey
): DimensionScore[] {
  return firms.map((firm, firmIndex) => {
    const metrics: MetricScore[] = [];
    let weightedScoreSum = 0;
    let appliedWeightSum = 0;

    specs.forEach((spec) => {
      let score = spec.fixedScore?.(firm);
      if (score == null) {
        const values = firms.map((current) => spec.valueGetter(current));
        score = normalizeMetric(values, firmIndex, spec.higherIsBetter);
      }
      if (score == null) return;

      metrics.push({
        label: spec.label,
        rawValue: spec.rawFormatter(firm),
        score: Number(score.toFixed(2)),
        higherIsBetter: spec.higherIsBetter,
      });
      weightedScoreSum += score * spec.weight;
      appliedWeightSum += spec.weight;
    });

    const dimensionScore = appliedWeightSum > 0 ? weightedScoreSum / appliedWeightSum : 5;
    return {
      key: dimensionKey,
      name: DIMENSION_NAMES[dimensionKey],
      score: Number(dimensionScore.toFixed(2)),
      metrics,
    };
  });
}

function digitalFixedScoreForDim1(value: FirmRawData["digitalisierungsgrad"]): number {
  if (value === "Niedrig") return 10;
  if (value === "Mittel") return 5;
  return 0;
}

function digitalFixedScoreForDim2(value: FirmRawData["digitalisierungsgrad"]): number {
  if (value === "Hoch") return 10;
  if (value === "Mittel") return 5;
  return 0;
}

function overtimeFixedScore(value: FirmRawData["ueberstundenquote"]): number {
  if (value === "Niedrig") return 10;
  if (value === "Moderat") return 5;
  return 0;
}

function metricSpecsByDimension() {
  return {
    optimizationLeverage: [
      {
        label: "Revenue / FTE",
        weight: 0.25,
        higherIsBetter: false,
        valueGetter: (firm) => (firm.fteTotal > 0 ? firm.revenue / firm.fteTotal : undefined),
        rawFormatter: (firm) => formatCurrency(firm.fteTotal > 0 ? firm.revenue / firm.fteTotal : 0),
      },
      {
        label: "Personnel Costs / FTE",
        weight: 0.25,
        higherIsBetter: false,
        valueGetter: (firm) => (firm.fteTotal > 0 ? firm.personnelCosts / firm.fteTotal : undefined),
        rawFormatter: (firm) => formatCurrency(firm.fteTotal > 0 ? firm.personnelCosts / firm.fteTotal : 0),
      },
      {
        label: "Honorar / Mandate",
        weight: 0.15,
        higherIsBetter: false,
        valueGetter: (firm) => firm.avgHonorarPerMandat,
        rawFormatter: (firm) => formatCurrency(firm.avgHonorarPerMandat),
      },
      {
        label: "Mandates / FTE",
        weight: 0.15,
        higherIsBetter: false,
        valueGetter: (firm) => (firm.fteTotal > 0 ? firm.activeMandates / firm.fteTotal : undefined),
        rawFormatter: (firm) => (firm.fteTotal > 0 ? (firm.activeMandates / firm.fteTotal).toFixed(2) : "n/a"),
      },
      {
        label: "Digitalization Level",
        weight: 0.125,
        higherIsBetter: false,
        valueGetter: () => undefined,
        fixedScore: (firm) => digitalFixedScoreForDim1(firm.digitalisierungsgrad),
        rawFormatter: (firm) => firm.digitalisierungsgrad,
      },
      {
        label: "Sick Leave Ratio",
        weight: 0.075,
        higherIsBetter: true,
        valueGetter: (firm) => firm.krankenquote,
        rawFormatter: (firm) => formatPercent(firm.krankenquote),
      },
    ] satisfies MetricSpec[],
    integrationEase: [
      {
        label: "Digitalization Level",
        weight: 0.3,
        higherIsBetter: true,
        valueGetter: () => undefined,
        fixedScore: (firm) => digitalFixedScoreForDim2(firm.digitalisierungsgrad),
        rawFormatter: (firm) => firm.digitalisierungsgrad,
      },
      {
        label: "Digital Document Share",
        weight: 0.25,
        higherIsBetter: true,
        valueGetter: (firm) => firm.digitalBelegeShare,
        rawFormatter: (firm) => formatPercent(firm.digitalBelegeShare),
      },
      {
        label: "DATEV Module Count",
        weight: 0.2,
        higherIsBetter: true,
        valueGetter: (firm) => firm.datevModuleCount,
        rawFormatter: (firm) => String(firm.datevModuleCount),
      },
      {
        label: "Client Portal Active",
        weight: 0.15,
        higherIsBetter: true,
        valueGetter: () => undefined,
        fixedScore: (firm) => (firm.mandantenportal ? 10 : 0),
        rawFormatter: (firm) => (firm.mandantenportal ? "Yes" : "No"),
      },
      {
        label: "Cloud Telephony",
        weight: 0.1,
        higherIsBetter: true,
        valueGetter: () => undefined,
        fixedScore: (firm) => (firm.cloudTelefonie == null ? undefined : firm.cloudTelefonie ? 10 : 0),
        rawFormatter: (firm) => (firm.cloudTelefonie == null ? "n/a" : firm.cloudTelefonie ? "Yes" : "No"),
      },
    ] satisfies MetricSpec[],
    growthPlatform: [
      {
        label: "Active Mandates",
        weight: 0.4,
        higherIsBetter: true,
        valueGetter: (firm) => firm.activeMandates,
        rawFormatter: (firm) => String(firm.activeMandates),
      },
      {
        label: "Revenue Growth",
        weight: 0.35,
        higherIsBetter: true,
        valueGetter: (firm) => {
          const jan = firm.monthlyRevenue[0];
          const dec = firm.monthlyRevenue[11];
          if (!jan) return undefined;
          return (dec - jan) / jan;
        },
        rawFormatter: (firm) => {
          const jan = firm.monthlyRevenue[0];
          const dec = firm.monthlyRevenue[11];
          if (!jan) return "n/a";
          return formatPercent((dec - jan) / jan);
        },
      },
      {
        label: "Special Consulting Share",
        weight: 0.25,
        higherIsBetter: true,
        valueGetter: (firm) => firm.specialConsultingShare,
        rawFormatter: (firm) => formatPercent(firm.specialConsultingShare),
      },
    ] satisfies MetricSpec[],
    dealAttractiveness: [
      {
        label: "Exit Pressure",
        weight: 0.4,
        higherIsBetter: true,
        valueGetter: () => undefined,
        fixedScore: (firm) => (firm.exitPressure ? 10 : 0),
        rawFormatter: (firm) => (firm.exitPressure ? "High" : "Low"),
      },
      {
        label: "Overtime Ratio",
        weight: 0.25,
        higherIsBetter: false,
        valueGetter: () => undefined,
        fixedScore: (firm) => overtimeFixedScore(firm.ueberstundenquote),
        rawFormatter: (firm) => firm.ueberstundenquote,
      },
      {
        label: "Interest Burden / Revenue",
        weight: 0.2,
        higherIsBetter: false,
        valueGetter: (firm) => firm.zinslastRatio,
        rawFormatter: (firm) => (firm.zinslastRatio == null ? "n/a" : formatPercent(firm.zinslastRatio)),
      },
      {
        label: "Revenue Volatility",
        weight: 0.15,
        higherIsBetter: false,
        valueGetter: (firm) => {
          const values = firm.monthlyRevenue.filter((value) => Number.isFinite(value));
          if (values.length === 0) return undefined;
          const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
          if (mean === 0) return undefined;
          const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
          const stddev = Math.sqrt(variance);
          return stddev / mean;
        },
        rawFormatter: (firm) => {
          const values = firm.monthlyRevenue.filter((value) => Number.isFinite(value));
          if (values.length === 0) return "n/a";
          const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
          if (mean === 0) return "n/a";
          const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
          const stddev = Math.sqrt(variance);
          return formatPercent(stddev / mean);
        },
      },
    ] satisfies MetricSpec[],
  };
}

export function computeFirmScores(
  firms: FirmRawData[],
  dimensionWeights: DimensionWeights = DEFAULT_DIMENSION_WEIGHTS
): FirmScore[] {
  if (firms.length === 0) return [];

  const specs = metricSpecsByDimension();
  const dim1 = computeDimension(firms, specs.optimizationLeverage, "optimizationLeverage");
  const dim2 = computeDimension(firms, specs.integrationEase, "integrationEase");
  const dim3 = computeDimension(firms, specs.growthPlatform, "growthPlatform");
  const dim4 = computeDimension(firms, specs.dealAttractiveness, "dealAttractiveness");

  return firms.map((firm, index) => {
    const dimensions = [dim1[index], dim2[index], dim3[index], dim4[index]];
    const weightedScore =
      dimensions[0].score * (dimensionWeights.optimizationLeverage / 100) +
      dimensions[1].score * (dimensionWeights.integrationEase / 100) +
      dimensions[2].score * (dimensionWeights.growthPlatform / 100) +
      dimensions[3].score * (dimensionWeights.dealAttractiveness / 100);

    return {
      firm,
      dimensions,
      opportunityScore: Number((weightedScore * 10).toFixed(2)),
    };
  });
}

