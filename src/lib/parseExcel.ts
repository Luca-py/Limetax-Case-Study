import * as XLSX from "xlsx";
import type {
  Digitalisierungsgrad,
  FirmRawData,
  ParseExcelResult,
  Ueberstundenquote,
} from "../types";

const MONTH_HEADERS = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const raw = String(value).trim();
  if (!raw) {
    return undefined;
  }
  const cleaned = raw
    .replace(/~/g, "")
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return undefined;
  }
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : undefined;
}

function parsePercent(value: unknown): number | undefined {
  if (typeof value === "number") {
    if (value <= 1) return value;
    if (value <= 100) return value / 100;
    return undefined;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const hasPercent = raw.includes("%");
  const num = parseNumber(raw);
  if (num == null) return undefined;
  if (hasPercent || num > 1) return num / 100;
  return num;
}

function parseBooleanJaNein(value: unknown): boolean | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (text.includes("ja")) return true;
  if (text.includes("nein")) return false;
  return undefined;
}

function parseDigitalisierungsgrad(value: unknown): Digitalisierungsgrad | undefined {
  const text = normalizeText(value);
  if (text.includes("niedrig")) return "Niedrig";
  if (text.includes("mittel")) return "Mittel";
  if (text.includes("hoch")) return "Hoch";
  return undefined;
}

function parseUeberstundenquote(value: unknown): Ueberstundenquote | undefined {
  const text = normalizeText(value);
  if (text.includes("niedrig")) return "Niedrig";
  if (text.includes("moderat")) return "Moderat";
  if (text.includes("hoch")) return "Hoch";
  return undefined;
}

function parseDatevModuleCount(value: unknown): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  return raw
    .split(/[\n,;/]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function parseExitPressure(value: unknown): boolean {
  const text = normalizeText(value);
  if (!text) return false;
  if (text.includes("exit")) return true;
  const ages = text.match(/\b(6\d|7\d)\b/g);
  return Boolean(ages && ages.length > 0);
}

function parseFluktuation(value: unknown): number | undefined {
  return parseNumber(value);
}

function findHeaderRow(rows: unknown[][], firstCellMatcher: string): number {
  return rows.findIndex((row) => normalizeText(row[0]) === normalizeText(firstCellMatcher));
}

function pickRow(rows: unknown[][], matcher: RegExp): unknown[] | undefined {
  return rows.find((row) => matcher.test(normalizeText(row[0])));
}

function parseBwaSheet(sheetName: string, rows: unknown[][]) {
  const warnings: string[] = [];
  const headerRowIndex = findHeaderRow(rows, "Position");
  if (headerRowIndex < 0) {
    throw new Error(`Sheet "${sheetName}" has no Position header row.`);
  }

  const headerRow = rows[headerRowIndex];
  const monthIndexes = MONTH_HEADERS.map((month) => headerRow.findIndex((cell) => normalizeText(cell) === normalizeText(month)));
  const gesamtIndex = headerRow.findIndex((cell) => normalizeText(cell) === "gesamt");

  if (gesamtIndex < 0 || monthIndexes.some((idx) => idx < 0)) {
    throw new Error(`Sheet "${sheetName}" has missing month or Gesamt columns.`);
  }

  const body = rows.slice(headerRowIndex + 1);
  const getOverall = (regex: RegExp, label: string): number | undefined => {
    const row = pickRow(body, regex);
    if (!row) {
      warnings.push(`Missing BWA metric: ${label}`);
      return undefined;
    }
    return parseNumber(row[gesamtIndex]);
  };

  const revenueRow = pickRow(body, /gesamtleistung/);
  if (!revenueRow) warnings.push("Missing BWA metric: Gesamtleistung");

  const monthlyRevenue = monthIndexes.map((idx) => parseNumber(revenueRow?.[idx]) ?? 0);

  const trailingValues = body.flatMap((row) =>
    row.slice(gesamtIndex + 1).map((cell) => parseNumber(cell)).filter((cell): cell is number => cell != null)
  );
  if (trailingValues.length > 0) {
    warnings.push("Trailing extra metric columns detected and ignored.");
  }

  return {
    name: sheetName.replace(/^BWA\s+/i, "").trim(),
    revenue: parseNumber(revenueRow?.[gesamtIndex]),
    personnelCosts: getOverall(/personalaufwand gesamt/, "Personalaufwand gesamt"),
    overheadCosts: getOverall(/sachaufwand gesamt/, "Sachaufwand gesamt"),
    ebitda: getOverall(/^ebitda$/, "EBITDA"),
    ebitdaMargin: getOverall(/ebitda-?marge/, "EBITDA-Marge"),
    zinslastRatio: getOverall(/zinsen.*aufwendungen/, "Zinslast / Umsatz"),
    monthlyRevenue,
    warnings,
  };
}

function parseProfileSheet(rows: unknown[][]) {
  const headerRowIndex = findHeaderRow(rows, "Kennzahl");
  if (headerRowIndex < 0) {
    throw new Error('Sheet "Kanzlei-Profil" has no Kennzahl header row.');
  }
  const header = rows[headerRowIndex];
  const firmColumns = header.slice(1).map((cell, index) => ({
    index: index + 1,
    name: String(cell ?? "").trim(),
    normalized: normalizeText(cell),
  }));

  const body = rows.slice(headerRowIndex + 1).filter((row) => String(row[0] ?? "").trim());

  const metricRows = new Map<string, unknown[]>();
  body.forEach((row) => {
    metricRows.set(normalizeText(row[0]), row);
  });

  return {
    firmColumns,
    getValue: (metricPattern: RegExp, columnIndex: number): unknown => {
      const row = body.find((candidate) => metricPattern.test(normalizeText(candidate[0])));
      return row?.[columnIndex];
    },
    metricRows,
  };
}

function requireNumber(value: number | undefined, label: string, warnings: string[]): number {
  if (value == null || Number.isNaN(value)) {
    warnings.push(`Could not parse metric: ${label}`);
    return 0;
  }
  return value;
}

function findProfileColumnIndex(bwaFirmName: string, columns: Array<{ index: number; normalized: string }>): number | undefined {
  const normalizedName = normalizeText(bwaFirmName);
  const direct = columns.find((col) => col.normalized.startsWith(normalizedName));
  return direct?.index;
}

export async function parseExcel(file: File): Promise<ParseExcelResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const bwaSheetNames = workbook.SheetNames.filter((name) => normalizeText(name).startsWith("bwa "));
  if (bwaSheetNames.length === 0) {
    throw new Error('No "BWA <FirmName>" sheets found.');
  }

  const profileSheetName = workbook.SheetNames.find((name) => normalizeText(name) === normalizeText("Kanzlei-Profil"));
  if (!profileSheetName) {
    throw new Error('Missing required sheet "Kanzlei-Profil".');
  }

  const profileRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[profileSheetName], {
    header: 1,
    defval: "",
  });
  const profile = parseProfileSheet(profileRows);

  const firms: FirmRawData[] = [];
  const globalWarnings: string[] = [];

  for (const sheetName of bwaSheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    const parsed = parseBwaSheet(sheetName, rows);
    const columnIndex = findProfileColumnIndex(parsed.name, profile.firmColumns);

    const warnings = [...parsed.warnings];
    if (columnIndex == null) {
      warnings.push(`No matching profile column for firm "${parsed.name}" in Kanzlei-Profil.`);
    }

    const getProfile = (regex: RegExp): unknown => (columnIndex == null ? undefined : profile.getValue(regex, columnIndex));

    const digitalisierungsgrad = parseDigitalisierungsgrad(getProfile(/digitalisierungsgrad/));
    const ueberstundenquote = parseUeberstundenquote(getProfile(/überstundenquote|ueberstundenquote/));

    if (!digitalisierungsgrad) warnings.push("Could not parse metric: Digitalisierungsgrad");
    if (!ueberstundenquote) warnings.push("Could not parse metric: Überstundenquote");

    const firm: FirmRawData = {
      name: parsed.name,
      revenue: requireNumber(parsed.revenue, "Gesamtleistung", warnings),
      personnelCosts: requireNumber(parsed.personnelCosts, "Personalaufwand gesamt", warnings),
      overheadCosts: requireNumber(parsed.overheadCosts, "Sachaufwand gesamt", warnings),
      ebitda: requireNumber(parsed.ebitda, "EBITDA", warnings),
      ebitdaMargin: requireNumber(parsed.ebitdaMargin, "EBITDA-Marge", warnings),
      monthlyRevenue: parsed.monthlyRevenue,
      foundingYear: requireNumber(parseNumber(getProfile(/gründungsjahr|gruendungsjahr/)), "Gründungsjahr", warnings),
      partners: requireNumber(parseNumber(getProfile(/berufsträger|berufstraeger|partner/)), "Berufsträger", warnings),
      fteSpecialists: requireNumber(parseNumber(getProfile(/fachkräfte|fachkraefte|fte/)), "Fachkräfte (FTE)", warnings),
      fteTotal: requireNumber(parseNumber(getProfile(/mitarbeiter gesamt/)), "Mitarbeiter gesamt", warnings),
      activeMandates: requireNumber(parseNumber(getProfile(/mandate aktiv/)), "Mandate aktiv", warnings),
      avgHonorarPerMandat: requireNumber(parseNumber(getProfile(/honorar je mandat/)), "Ø Honorar je Mandat", warnings),
      specialConsultingShare: requireNumber(parsePercent(getProfile(/sonderberatung|projekte/)), "Mandatsmix Sonderberatung", warnings),
      digitalisierungsgrad: digitalisierungsgrad ?? "Mittel",
      digitalBelegeShare: requireNumber(parsePercent(getProfile(/digitale belege/)), "Anteil digitale Belege", warnings),
      mandantenportal: parseBooleanJaNein(getProfile(/mandantenportal aktiv/)) ?? false,
      cloudTelefonie: parseBooleanJaNein(getProfile(/cloud-telefonie|cloud telefonie/)),
      datevModuleCount: requireNumber(parseDatevModuleCount(getProfile(/datev-module|datev module/)), "DATEV-Module", warnings),
      exitPressure: parseExitPressure(getProfile(/nachfolgesituation/)),
      fluktuation: requireNumber(parseFluktuation(getProfile(/fluktuation/)), "Fluktuation", warnings),
      krankenquote: requireNumber(parsePercent(getProfile(/krankenquote/)), "Krankenquote", warnings),
      ueberstundenquote: ueberstundenquote ?? "Moderat",
      zinslastRatio: parsed.zinslastRatio,
      warnings: warnings.map((message) => ({ code: "PARSE_WARNING", message })),
    };

    firms.push(firm);
  }

  if (firms.length === 1) {
    globalWarnings.push("Only one firm uploaded. Scores are neutral by design.");
  }

  return { firms, globalWarnings };
}

