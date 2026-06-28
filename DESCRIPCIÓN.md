# Nexora Ceramica - Generador de Packing Lists

A client-side SPA for NEXORA CERAMICA S.L. that automates logistics document creation. Users upload supplier invoices (PDF), the app uses OpenAI Vision to extract line items and apply tile-format conversion rules, then outputs editable packing lists exportable as DOCX or PDF.

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
- AI: OpenAI gpt-4o-2024-08-06 (Structured Outputs, client-side fetch, user provides API key)
- Export: `docx` (programmatic DOCX), `@react-pdf/renderer` (PDF), `file-saver`
- Validation: Zod
- API: Express 5, DB: PostgreSQL + Drizzle ORM (api-server only)

## Where things live

- Frontend app: `artifacts/nexora-app/src/`
  - `types/packing.ts` — Zod schema + TypeScript types
  - `services/openaiService.ts` — OpenAI API integration with Structured Outputs
  - `services/calculationsService.ts` — Pure business logic (pieces, weights, CBM)
  - `utils/exportDocx.ts` — DOCX generation (programmatic, with docxtemplater hook comments)
  - `utils/exportPdf.tsx` — PDF generation via @react-pdf/renderer
  - `components/PackingTable.tsx` — TanStack Table with inline editing + footer aggregators
  - `components/UploadZone.tsx` — Drag-and-drop PDF uploader
  - `components/SettingsPanel.tsx` — API key manager (localStorage)
- API server: `artifacts/api-server/src/`
- DB schema: `lib/db/src/schema/index.ts` — `packing_sessions` table (id, name, meta JSON, rows JSON, timestamps)
- Sessions API: `artifacts/api-server/src/routes/sessions.ts` — GET/POST/DELETE /api/sessions
- Sessions UI: `artifacts/nexora-app/src/components/SessionsPanel.tsx`
- API spec: `lib/api-spec/openapi.yaml`

## Architecture decisions

- **100% client-side AI processing**: OpenAI calls are made directly from the browser using the user's own API key stored in localStorage. No backend proxy needed.
- **Structured Outputs**: Uses OpenAI's `response_format: { type: "json_schema" }` with strict schema validation to ensure deterministic JSON responses.
- **Business logic in two places**: AI system prompt instructs gpt-4o to apply tile conversion rules, and `calculationsService.ts` recalculates when the user edits cells inline — ensuring consistency.
- **docxtemplater + docx dual approach**: `exportDocx.ts` uses the `docx` library for functional programmatic generation, with explicit code comments showing exactly where to connect a `docxtemplater` + `pizzip` template file.
- **TanStack Table headless architecture**: All cells render `<input>` elements for inline editing; footer row aggregates update reactively from table state.

## Product

- Upload a PDF invoice → AI extracts supplier, client, and line item data
- Auto-converts m² quantities to physical pieces, A-Frame pallet counts, net/gross weights, CBM
- Editable grid table with live footer totals (bultos, kg neto, kg bruto, CBM)
- Add/delete rows manually
- Export as DOCX (corporate Word document) or PDF (vectorial, landscape)
- Save named sessions to PostgreSQL and restore them from a sidebar panel
- API key stored securely in browser localStorage

## User preferences

- UI language: Spanish
- Brand: NEXORA CERAMICA S.L. navy blue (#1E3A5F primary), B24881047

## Gotchas

- The OpenAI API call uses `image_url` with `data:application/pdf;base64,...` — gpt-4o supports PDF vision
- A-Frame recalculation triggers on `packing_type` or `quantity_pieces` changes; CBM recalculates on dimension/unit changes
- `@react-pdf/renderer` uses its own React reconciler — do NOT use hooks inside `<Document>` components
- `docx` package v9+ uses ESM; ensure Vite doesn't externalize it

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- `react-vite` skill for frontend conventions
