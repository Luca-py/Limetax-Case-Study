export type Digitalisierungsgrad = "Niedrig" | "Mittel" | "Hoch";
export type Ueberstundenquote = "Niedrig" | "Moderat" | "Hoch";
export type PromptLanguage = "EN" | "DE";

export type DimensionKey =
  | "optimizationLeverage"
  | "integrationEase"
  | "growthPlatform"
  | "dealAttractiveness";

export interface FirmWarning {
  code: string;
  message: string;
}

export interface FirmRawData {
  name: string;
  revenue: number;
  personnelCosts: number;
  overheadCosts: number;
  ebitda: number;
  ebitdaMargin: number;
  monthlyRevenue: number[];
  foundingYear: number;
  partners: number;
  fteSpecialists: number;
  fteTotal: number;
  activeMandates: number;
  avgHonorarPerMandat: number;
  specialConsultingShare: number;
  digitalisierungsgrad: Digitalisierungsgrad;
  digitalBelegeShare: number;
  mandantenportal: boolean;
  cloudTelefonie?: boolean;
  datevModuleCount: number;
  exitPressure: boolean;
  fluktuation: number;
  krankenquote: number;
  ueberstundenquote: Ueberstundenquote;
  zinslastRatio?: number;
  warnings: FirmWarning[];
}

export interface MetricScore {
  label: string;
  rawValue: string;
  score: number;
  higherIsBetter: boolean;
}

export interface DimensionScore {
  key: DimensionKey;
  name: string;
  score: number;
  metrics: MetricScore[];
}

export interface FirmScore {
  firm: FirmRawData;
  dimensions: DimensionScore[];
  opportunityScore: number;
  wins?: string[];
  risks?: string[];
}

export interface ParseExcelResult {
  firms: FirmRawData[];
  globalWarnings: string[];
}

export interface DimensionWeights {
  optimizationLeverage: number;
  integrationEase: number;
  growthPlatform: number;
  dealAttractiveness: number;
}

export interface DashboardFilters {
  minEbitdaMargin: number;
  minFte: number;
  digitallyReadyOnly: boolean;
}

