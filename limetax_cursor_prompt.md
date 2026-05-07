# Limetax — Kanzlei Intelligence Dashboard (MVP)

## Overview

Build a single-page React + TypeScript web app that:
1. Accepts an Excel (.xlsx) file upload containing BWA data and operative profiles of German tax advisory firms (Steuerberatungskanzleien)
2. Parses the data client-side
3. Computes an **Opportunity Score** across 4 dimensions for each firm
4. Renders a dashboard matching the sketch layout described below
5. Uses **OpenRouter** to generate LLM-powered TLDR summaries and Biggest Wins / Biggest Risks per firm

---

## Tech Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** for styling
- **shadcn/ui** for base components (accordion, slider, sheet/drawer for settings)
- **Recharts** for radar charts
- **xlsx** (SheetJS) for Excel parsing client-side
- **OpenRouter** for LLM calls — use the OpenAI-compatible REST API (`https://openrouter.ai/api/v1/chat/completions`)
- No SDK needed — plain `fetch` calls are sufficient
- Store in `.env`: `VITE_OPENROUTER_API_KEY` and `VITE_OPENROUTER_MODEL` (e.g. `anthropic/claude-sonnet-4-5`)

---

## Excel File Structure

The uploaded Excel file has these sheets:

### Sheets `BWA <FirmName>` (one per firm, e.g. `BWA Bergmann`, `BWA Fiedler`, `BWA Nowak`)
Row structure (German labels, tab-separated months Jan–Dez + Gesamt column):
- `Gesamtleistung` — total revenue
- `Personalaufwand gesamt` — total personnel costs
- `Sachaufwand gesamt` — total overhead costs
- `EBITDA` — EBITDA
- `EBITDA-Marge` — EBITDA margin (decimal)

Key: extract the **Gesamt** (annual total) column for each metric.
Also extract monthly revenue (Jan–Dez) for trend calculation.

### Sheet `Kanzlei-Profil`
Row/column structure — columns are firms, rows are metrics:
- `Gründungsjahr`
- `Berufsträger (Partner)`
- `Fachkräfte (FTE)`
- `Mitarbeiter gesamt`
- `Mandate aktiv`
- `Ø Honorar je Mandat (EUR/Jahr)` — parse numeric value from string like `~2.400`
- `Mandatsmix: Sonderberatung/Projekte` — parse percentage
- `Digitalisierungsgrad` — values: `Niedrig` / `Mittel` / `Hoch`
- `Anteil digitale Belege` — parse percentage from string like `~50%`
- `Mandantenportal aktiv` — contains `Ja` or `Nein`
- `DATEV-Module` — free text, count number of modules listed
- `Nachfolgesituation` — free text, classify: contains `Exit` or old partner ages → high exit pressure
- `Fluktuation (letzte 12M)` — parse number of departures from string like `2 Abgänge`
- `Krankenquote` — parse percentage from string like `~6%`
- `Überstundenquote` — values: `Niedrig` / `Moderat` / `Hoch`

---

## Opportunity Score Framework

Compute a weighted **Opportunity Score (0–100)** per firm across 4 dimensions.

### Normalization Rules
- All metric scores are normalized **relative to the uploaded firms** on a 0–10 scale
- Formula: `score = (value - min) / (max - min) × 10`
- If all firms share the same value for a metric (no spread), assign **5 (neutral)** to all — do not penalize
- For **binary metrics** (Ja/Nein, exit pressure yes/no): 10 or 0, no normalization needed
- For **fixed ordinal metrics** (Digitalisierungsgrad, Überstundenquote): use fixed mappings, no normalization

---

### Dimension 1: Room for Improvement (Optimierungshebel) — weight: 35%
*Higher score = more inefficiency = more value Limetax can extract*

All metrics here are **inverted**: the least efficient firm scores highest.

| Metric | Calculation | Direction | Weight within dim |
|---|---|---|---|
| Umsatz / FTE | Gesamtleistung ÷ Mitarbeiter gesamt | low → high score | 25% |
| Personalkosten / FTE | Personalaufwand gesamt ÷ Mitarbeiter gesamt | low → high score | 25% |
| Honorar / Mandat | Ø Honorar je Mandat | low → high score | 15% |
| Mandate / FTE | Mandate aktiv ÷ Mitarbeiter gesamt | low → high score | 15% |
| Digitalisierungsgrad | Niedrig=10, Mittel=5, Hoch=0 | fixed | 12.5% |
| Krankenquote | parse % from string | high → high score | 7.5% |

---

### Dimension 2: Integration Complexity (Integrationskomplexität) — weight: 30%
*Higher score = easier to integrate into Limetax platform*

| Metric | Calculation | Direction | Weight within dim |
|---|---|---|---|
| Digitalisierungsgrad | Hoch=10, Mittel=5, Niedrig=0 | fixed — **opposite of Dim 1, intentional** | 30% |
| Anteil digitale Belege | parse % from string (e.g. `~85%` → 0.85) | high → high score | 25% |
| DATEV-Module count | count comma-separated modules in string | high → high score | 20% |
| Mandantenportal aktiv | Ja=10, Nein=0 | binary | 15% |
| Cloud-Telefonie | Ja=10, Nein=0 | binary | 10% |

---

### Dimension 3: Growth Potential (Wachstumspotenzial) — weight: 20%
*Higher score = stronger platform and organic momentum to grow from*

| Metric | Calculation | Direction | Weight within dim |
|---|---|---|---|
| Mandate aktiv | direct value | high → high score | 40% |
| Umsatzwachstum | (Dez revenue - Jan revenue) ÷ Jan revenue | high → high score | 35% |
| Anteil Sonderberatung/Projekte | parse % from Mandatsmix row | high → high score | 25% |

---

### Dimension 4: Acquisition Appeal (Akquisitionsattraktivität) — weight: 15%
*Higher score = more motivated seller, lower execution risk*

| Metric | Calculation | Direction | Weight within dim |
|---|---|---|---|
| Nachfolgesituation | detect exit pressure: text contains `Exit` or partner age ≥ 60 in string → 10, else 0 | binary | 40% |
| Überstundenquote | Niedrig=10, Moderat=5, Hoch=0 | fixed | 25% |
| Zinslast / Umsatz | Zinsen & ähnliche Aufwendungen Gesamt ÷ Gesamtleistung | low → high score | 20% |
| Umsatzvolatilität | stddev(monthlyRevenue) ÷ mean(monthlyRevenue) — lower = more stable | low → high score | 15% |

---

### Final Score
```
OpportunityScore = (Dim1 × 0.35 + Dim2 × 0.30 + Dim3 × 0.20 + Dim4 × 0.15) × 10
```
Each dimension score is 0–10, so OpportunityScore is 0–100.
Weights are user-configurable in Settings (sliders that always sum to 100%).

---

## App Layout (follow the sketch exactly)

```
┌─────────────────────────────────────────────────────┐
│  HEADER: "Limetax Intelligence" logo + Settings ⚙   │
├─────────────────────────────────────────────────────┤
│  UPLOAD ZONE (shown only before file is loaded)     │
│  "Drop your Excel file here"                        │
└─────────────────────────────────────────────────────┘

After file is loaded, show dashboard:

┌─────────────────────────────────────────────────────┐
│  TLDR SECTION                                       │
│  [LLM-powered paragraph — 3-4 sentences]            │
│  [Small sparkline/trend chart showing revenue       │
│   trajectory for all firms overlaid]                │
└─────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  COMPANY GRID  [+ Add Company button top-right]            │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Company 1    │  │ Company 2    │  │ Company 3    │     │
│  │              │  │              │  │              │     │
│  │ Score: 78    │  │ Score: 41    │  │ Score: 64    │     │
│  │              │  │              │  │              │     │
│  │ [Radar Chart]│  │ [Radar Chart]│  │ [Radar Chart]│     │
│  │  5 dimensions│  │              │  │              │     │
│  │  with labels │  │              │  │              │     │
│  │              │  │              │  │              │     │
│  │ 👑 Biggest   │  │ 👑 Biggest   │  │ 👑 Biggest   │     │
│  │ Wins         │  │ Wins         │  │ Wins         │     │
│  │ [LLM text]   │  │ [LLM text]   │  │ [LLM text]   │     │
│  │              │  │              │  │              │     │
│  │ ⚠ Biggest   │  │ ⚠ Biggest   │  │ ⚠ Biggest   │     │
│  │ Risks        │  │ Risks        │  │ Risks        │     │
│  │ [LLM text]   │  │ [LLM text]   │  │ [LLM text]   │     │
│  │              │  │              │  │              │     │
│  │ ▶ Dim 1      │  │ ▶ Dim 1      │  │ ▶ Dim 1      │     │
│  │ ▶ Dim 2      │  │ ▶ Dim 2      │  │ ▶ Dim 2      │     │
│  │ ▶ Dim 3      │  │ ▶ Dim 3      │  │ ▶ Dim 3      │     │
│  │ ▶ Dim 4      │  │ ▶ Dim 4      │  │ ▶ Dim 4      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────────────────────────────────────────┘
```

### Collapsible Dimension Rows
Each dimension accordion shows a **metrics table** when expanded:

```
▼ Optimierungshebel                        Score: 8.2 / 10
┌────────────────────────────┬────────────┬──────────┐
│ Metric                     │ Raw Value  │ Score    │
├────────────────────────────┼────────────┼──────────┤
│ Personalkosten-Quote       │ 63%        │ 10 ↑     │
│ Umsatz / FTE               │ €54.4k     │ 3        │
│ Honorar / Mandat           │ €2,200     │ 10 ↑     │
│ Digitalisierungsgrad       │ Niedrig    │ 10 ↑     │
│ Krankenquote               │ 9%         │ 8        │
│ Überstundenquote           │ Hoch       │ 10 ↑     │
└────────────────────────────┴────────────┴──────────┘
```

Use ↑ / ↓ arrows and color (green/red) to indicate whether high/low is good for that metric.

---

## Settings Panel (Slide-over / Sheet from right)

Accessible via ⚙ icon in header. Contains:

### Dimension Weights
Four sliders (0–100), always summing to 100. Use a "locked" sum mechanic — adjusting one slider redistributes proportionally across others.

```
Room for Improvement      [====|====] 35%
Integration Complexity    [===|=====] 30%
Growth Potential          [==|======] 20%
Acquisition Appeal        [=|=======] 15%
```

### Thresholds / Filters
- Minimum EBITDA margin: number input (default: 0%)
- Minimum company size (FTE): number input (default: 0)
- Only show digitally-ready firms (Digitalisierungsgrad ≥ Mittel): toggle — default OFF

### Display
- Language toggle: DE / EN (affects LLM prompt language)

---

## LLM Integration (OpenRouter)

### TLDR Summary
Called once after file parse. Prompt:

```
System: You are an M&A analyst at Limetax, an AI-powered buy-and-build platform 
acquiring German tax advisory firms (Steuerberatungskanzleien). Be concise, direct, 
and opinionated. Write in {language}.

User: Here is the benchmarking data for {n} firms:
{JSON summary of all firms with key metrics and opportunity scores}

Write a 3-4 sentence executive TLDR. Lead with the single most important insight. 
Name the firms directly. End with a clear acquisition recommendation.
```

### Biggest Wins & Risks (per firm)
Called once per firm. Prompt:

```
System: You are an M&A analyst at Limetax. Be extremely concise. 
Write in {language}.

User: Firm: {name}
Data: {JSON of firm metrics and dimension scores}

Return JSON in this exact format:
{
  "wins": ["win 1 (max 12 words)", "win 2 (max 12 words)", "win 3 (max 12 words)"],
  "risks": ["risk 1 (max 12 words)", "risk 2 (max 12 words)", "risk 3 (max 12 words)"]
}
```

Show a loading skeleton while LLM calls are in flight. Cache results — don't re-call on re-render.

### OpenRouter fetch helper (`src/lib/openrouter.ts`)
```typescript
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'

export async function chatCompletion(messages: {role: string, content: string}[]): Promise<string> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENROUTER_MODEL,
      messages,
    }),
  })
  const data = await res.json()
  return data.choices[0].message.content
}
```

---

## File Structure

```
limetax-dashboard/
├── src/
│   ├── components/
│   │   ├── UploadZone.tsx
│   │   ├── TldrSection.tsx
│   │   ├── CompanyCard.tsx
│   │   ├── RadarChart.tsx
│   │   ├── DimensionAccordion.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── SparklineChart.tsx
│   ├── lib/
│   │   ├── parseExcel.ts       # SheetJS parsing logic
│   │   ├── scoring.ts          # All scoring/normalization logic
│   │   └── openrouter.ts       # OpenRouter fetch wrappers
│   ├── types/
│   │   └── index.ts            # FirmData, DimensionScore, OpportunityScore types
│   ├── App.tsx
│   └── main.tsx
├── .env                        # VITE_OPENROUTER_API_KEY=... + VITE_OPENROUTER_MODEL=...
├── package.json
└── vite.config.ts
```

---

## Key Types

```typescript
interface FirmRawData {
  name: string;
  // From BWA sheet
  revenue: number;               // Gesamtleistung Gesamt
  personnelCosts: number;        // Personalaufwand gesamt Gesamt
  overheadCosts: number;         // Sachaufwand gesamt Gesamt
  ebitda: number;
  ebitdaMargin: number;
  monthlyRevenue: number[];      // Jan–Dez, length 12
  // From Kanzlei-Profil
  foundingYear: number;
  partners: number;
  fteSpecialists: number;
  fteTotal: number;
  activeMandates: number;
  avgHonorarPerMandat: number;
  specialConsultingShare: number; // 0–1
  digitalisierungsgrad: 'Niedrig' | 'Mittel' | 'Hoch';
  digitalBelegeShare: number;    // 0–1
  mandantenportal: boolean;
  datevModuleCount: number;
  exitPressure: boolean;          // derived from Nachfolgesituation
  fluktuation: number;            // number of departures
  krankenquote: number;           // 0–1
  ueberstundenquote: 'Niedrig' | 'Moderat' | 'Hoch';
}

interface DimensionScore {
  name: string;
  score: number;                 // 0–10
  metrics: MetricScore[];
}

interface MetricScore {
  label: string;
  rawValue: string;              // formatted for display
  score: number;                 // 0–10
  higherIsBetter: boolean;       // for ↑/↓ indicator
}

interface FirmScore {
  firm: FirmRawData;
  dimensions: DimensionScore[];
  opportunityScore: number;      // 0–100
  wins?: string[];               // LLM-generated
  risks?: string[];              // LLM-generated
}
```

---

## Styling Direction

- **Dark theme** — deep navy/charcoal background (`#0A0C14`), not pure black
- **Accent color** — `#4D6EF6` (electric blue) for highlights, scores, active states, CTAs
- **Supporting colors:**
  - Surface/card background: `#111320`
  - Border: `rgba(77, 110, 246, 0.15)`
  - Muted text: `#5A6080`
  - Body text: `#C8CCE0`
- **Typography** — `DM Serif Display` for headings, `DM Mono` for numbers/scores, `DM Sans` for body (all from Google Fonts)
- **Cards** — subtle `#4D6EF6` border tint, slight background lift, no heavy shadows
- **Radar charts** — each firm gets a distinct color: Bergmann=`#4D6EF6` (accent blue), Fiedler=`#F2645A` (coral red), Nowak=`#4ECFB3` (teal)
- **Score display** — large mono font, colored by range: 0–40 `#F2645A` red, 41–65 `#F5A623` amber, 66–100 `#4ECFB3` green
- **Score bar / progress fill** — use `#4D6EF6` as base fill color
- No purple gradients on white. No Inter. No rounded pill buttons everywhere.

## Language

- **All UI labels, headings, button text, and static copy must be in English**
- LLM prompts should default to English (the language toggle in Settings can switch to German)
- Dimension names in English: "Optimization Leverage", "Growth Platform", "Deal Attractiveness", "Integration Ease"

---

## Notes & Edge Cases

- **Relative scoring**: all metric scores are normalized relative to the uploaded firms. If only 1 firm is uploaded, all scores = 5 (neutral). Min firm count for meaningful scoring: 2.
- **"+ Add Company" button**: for MVP, show a toast saying "Upload an Excel file with additional sheets to add companies." Don't build multi-file support yet.
- **Parse robustness**: strip `~`, `%`, `.` (German thousands separator), parse `2 Abgänge` → `2`, `Ja (DATEV UO)` → `true`.
- **Error state**: if a sheet is missing or a required metric can't be parsed, show a yellow warning banner per firm, not a full crash.
- **No backend needed**: all parsing and scoring is client-side. Only external call is Anthropic API (direct from browser, acceptable for MVP/demo).
