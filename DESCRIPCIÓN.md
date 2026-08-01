# Nexora Ceramica - Generador de Packing Lists

A client-side SPA for NEXORA CERAMICA S.L. that automates logistics document creation. Users upload supplier invoices or packing lists (PDF, DOCX, TXT/CSV or image); the app reads them **deterministically in the browser** — no AI — by locating the table header, mapping supplier column names onto NEXORA's, and transcribing the rows. It then checks its own sums against the totals the document prints. The editable result is exported as NEXORA's official packing list in PDF (portrait or landscape) or DOCX. OpenAI is used only for scans with no text layer and for an on-demand verification pass.

## Run & Operate

- `pnpm --filter @workspace/nexora-app run dev` — run the frontend (port 21764, served at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `DATABASE_URL` — Postgres connection string (for API server only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite 7 + Tailwind CSS v4 + Shadcn UI components
- Table: TanStack Table v8 with inline cell editing
- Extraction: `pdfjs-dist` (PDF text + coordinates), `pizzip` (DOCX OOXML) — all offline
- AI (optional): OpenAI `gpt-4o` for scans, `gpt-4o-mini` for verification; client-side fetch, user provides API key
- Export: `docx` (programmatic DOCX), `@react-pdf/renderer` (PDF), `file-saver`
- Validation: Zod
- API: Express 5, DB: PostgreSQL + Drizzle ORM (api-server only)

## Where things live

- Frontend app: `artifacts/nexora-app/src/`
  - `types/packing.ts` — Zod schema + TypeScript types + `normalizeRow`/`normalizeMeta`
  - `services/extraction/` — the AI-free pipeline; `index.ts` orchestrates `readPdf` → `lines` → `table` → `buildRows` → `validate`
  - `services/aiService.ts` — OpenAI, used only for scans (`aiReadScan`), text rescue (`aiReadText`) and verification (`aiVerify`)
  - `services/calculationsService.ts` — Pure business logic (pieces, weights, CBM)
  - `utils/nexoraPdfTheme.ts` — brand colours, company data and the model's column proportions
  - `utils/packingGroups.ts` — groups rows into container blocks; shared by both exporters
  - `utils/exportPdf.tsx` — the official model via @react-pdf/renderer, portrait or landscape
  - `utils/exportDocx.ts` — the same model in Word, via the `docx` library
  - `components/PackingTable.tsx` — TanStack Table with inline editing + footer aggregators
  - `components/UploadZone.tsx` — Drag-and-drop uploader (PDF/DOCX/TXT/image)
  - `components/ExtractionReport.tsx` — method, confidence, recognised columns, issues, "verify with AI"
  - `components/SettingsPanel.tsx` — optional API key manager (localStorage)
- API server: `artifacts/api-server/src/`
- DB schema: `lib/db/src/schema/index.ts` — `packing_sessions` table (id, name, meta JSON, rows JSON, timestamps)
- Sessions API: `artifacts/api-server/src/routes/sessions.ts` — GET/POST/DELETE /api/sessions
- Sessions UI: `artifacts/nexora-app/src/components/SessionsPanel.tsx`
- API spec: `lib/api-spec/openapi.yaml`

## Architecture decisions

- **Deterministic first, AI last**: the default path is offline layout parsing. The model is reached only when the file has no text layer, when no table could be recognised at all, or when the operator explicitly asks for verification.
- **Header-driven column mapping**: `fields.ts` holds the ES/EN/IT synonym dictionary; once a heading is recognised its x-range becomes a band and everything beneath it is data. Unrecognised headings still reserve a band so their values cannot bleed into a neighbour.
- **Merged cells are geometry, not guesswork**: a container cell spanning k rows is printed at their midpoint, so its position encodes the block extent. `buildRows.ts` solves that recurrence instead of matching by proximity, which is off by one at block boundaries.
- **Absent ≠ zero**: `parseNumber` returns `null` for a blank cell and `0` for a printed zero, and a column the document prints is never recomputed — only genuinely missing columns get the ceramic formulas, and the report says which.
- **Self-verification**: `validate.ts` compares the row sums with the totals the document prints; agreement is the signal that no AI is needed, disagreement is reported per column and lowers the confidence score.
- **One model, two renderers**: `nexoraPdfTheme.ts` + `packingGroups.ts` are shared by the PDF and DOCX exporters, so the two outputs cannot drift apart. Every width is a share of the page, so portrait and landscape are the same document reflowed.
- **TanStack Table headless architecture**: All cells render `<input>` elements for inline editing; footer row aggregates update reactively from table state.

## Product

- Upload up to 3 documents (PDF / DOCX / TXT / image) → the app reads supplier, client, container and line item data offline
- Reports how it read the document, which columns it recognised, and whether its sums match the document's own totals
- Converts m² to physical pieces, A-Frame pallet counts and net/gross weights — only for columns the document does not provide
- Editable grid with container and seal columns and live footer totals
- Add/delete rows and columns manually
- Generate the official NEXORA packing list: PDF vertical, PDF horizontal, or DOCX
- Optional "Verify with AI" pass that contrasts the table against the document text
- Save named sessions to PostgreSQL and restore them from a sidebar panel
- Optional API key stored in browser localStorage

## User preferences

- UI language: Spanish
- Brand: NEXORA CERAMICA S.L. — charcoal ink (#1A1A1A) with warm gold accent (#B8935A), B24881047

## Gotchas

- pdf.js needs its worker: `readPdf.ts` imports `pdfjs-dist/build/pdf.worker.min.mjs?url`, which Vite emits as a separate asset. In Node (tests) use the `legacy` build and set `GlobalWorkerOptions.workerSrc` to the legacy worker file.
- `fmtNum` is hand-written rather than `toLocaleString("es-ES")`: the Spanish locale drops the thousands separator on four-digit numbers ("1260,00"), while the NEXORA document always groups them ("1.260,00").
- `@react-pdf/renderer` uses its own React reconciler — do NOT use hooks inside `<Document>` components. Use `fixed` on the table header row so it repeats on every page, and `wrap={false}` on a container block so it is never split.
- `docx` package v9+ uses ESM; ensure Vite doesn't externalize it. `rowSpan` on a `TableCell` is declared once on the first row — the library inserts the `vMerge` continuation cells itself.
- Restored sessions and AI output go through `normalizeRow`/`normalizeMeta` so older records without `contenedor`/`precinto` still load.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- `react-vite` skill for frontend conventions
