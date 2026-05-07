import OpenAI from "openai";
import type { FirmScore, PromptLanguage } from "../types";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface WinsRisks {
  wins: string[];
  risks: string[];
}

function formatMetricDirection(higherIsBetter: boolean): string {
  return higherIsBetter ? "higher is better" : "lower is better";
}

function buildMetricContext(firm: FirmScore): string {
  const metrics = firm.dimensions.flatMap((dimension) =>
    dimension.metrics.map((metric) => ({
      dimension: dimension.name,
      label: metric.label,
      score: metric.score,
      rawValue: metric.rawValue,
      higherIsBetter: metric.higherIsBetter,
    }))
  );

  const sortedByScore = [...metrics].sort((a, b) => b.score - a.score);
  const topStrengths = sortedByScore.slice(0, 3);
  const topRisks = [...sortedByScore].reverse().slice(0, 3);

  const formatLine = (entry: (typeof metrics)[number]) =>
    `${entry.dimension} > ${entry.label}: raw=${entry.rawValue}, score=${entry.score.toFixed(2)}, direction=${formatMetricDirection(entry.higherIsBetter)}`;

  return [
    "Top strengths by metric score:",
    ...topStrengths.map((entry) => `- ${formatLine(entry)}`),
    "Top risks by metric score:",
    ...topRisks.map((entry) => `- ${formatLine(entry)}`),
  ].join("\n");
}

export async function chatCompletion(messages: Message[]): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  const model = import.meta.env.VITE_OPENROUTER_MODEL as string | undefined;
  if (!apiKey || !model) {
    throw new Error("OpenRouter environment variables are missing.");
  }

  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      "HTTP-Referer": window.location.origin,
      "X-OpenRouter-Title": "Limetax Intelligence",
    },
  });

  const completion = await openai.chat.completions.create({
    model,
    messages,
  });

  const content = completion.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

function promptLanguageToText(language: PromptLanguage): string {
  return language === "DE" ? "German" : "English";
}

export async function generatePortfolioTldr(firmScores: FirmScore[], language: PromptLanguage): Promise<string> {
  const summary = firmScores.map((entry) => ({
    name: entry.firm.name,
    opportunityScore: entry.opportunityScore,
    ebitdaMargin: entry.firm.ebitdaMargin,
    revenue: entry.firm.revenue,
    dimensions: entry.dimensions.map((dimension) => ({ name: dimension.name, score: dimension.score })),
  }));

  return chatCompletion([
    {
      role: "system",
      content: `You are an M&A analyst at Limetax, an AI-powered buy-and-build platform acquiring German tax advisory firms (Steuerberatungskanzleien). Be concise, direct, and opinionated. Write in ${promptLanguageToText(language)}.`,
    },
    {
      role: "user",
      content: `Here is the benchmarking data for ${firmScores.length} firms:\n${JSON.stringify(summary, null, 2)}\n\nWrite a 3-4 sentence executive TLDR. Lead with the single most important insight. Name the firms directly. End with a clear acquisition recommendation.`,
    },
  ]);
}

function parseWinsRisks(payload: string): WinsRisks {
  try {
    const cleaned = payload.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<WinsRisks>;
    return {
      wins: Array.isArray(parsed.wins) ? parsed.wins.slice(0, 3).map(String) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 3).map(String) : [],
    };
  } catch {
    return { wins: [], risks: [] };
  }
}

export async function generateFirmWinsRisks(firm: FirmScore, language: PromptLanguage): Promise<WinsRisks> {
  const metricContext = buildMetricContext(firm);
  const payload = await chatCompletion([
    {
      role: "system",
      content: `You are an M&A analyst at Limetax. Be extremely concise. Write in ${promptLanguageToText(language)}.`,
    },
    {
      role: "user",
      content: `Firm: ${firm.firm.name}\nData: ${JSON.stringify(
        {
          opportunityScore: firm.opportunityScore,
          dimensions: firm.dimensions,
          keyMetrics: {
            revenue: firm.firm.revenue,
            ebitdaMargin: firm.firm.ebitdaMargin,
            mandates: firm.firm.activeMandates,
            digitalisierungsgrad: firm.firm.digitalisierungsgrad,
          },
        },
        null,
        2
      )}\n\nMetric direction context:\n${metricContext}\n\nRules:\n- Use metric scores first; higher score = stronger win, lower score = stronger risk.\n- Respect direction. If direction says "lower is better", a LOW raw value is positive and a HIGH raw value is negative.\n- Do not write a win that praises a high value when direction is "lower is better".\n- Keep each bullet factual and specific to this firm.\n\nReturn JSON in this exact format:\n{\n  "wins": ["win 1 (max 12 words)", "win 2 (max 12 words)", "win 3 (max 12 words)"],\n  "risks": ["risk 1 (max 12 words)", "risk 2 (max 12 words)", "risk 3 (max 12 words)"]\n}`,
    },
  ]);

  return parseWinsRisks(payload);
}

