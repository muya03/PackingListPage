import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type Row,
  type VisibilityState,
} from "@tanstack/react-table";
import { Trash2, PlusCircle, Columns3, Check, X, Plus } from "lucide-react";
import { makeRowId, type TableRow } from "@/types/packing";

const BADGE_STYLES = [
  "bg-blue-100 text-blue-700 ring-1 ring-blue-300",
  "bg-green-100 text-green-700 ring-1 ring-green-300",
];

interface PackingTableProps {
  data: TableRow[];
  onChange: (rows: TableRow[]) => void;
  showSourceFile?: boolean;
  sourceFileNames?: string[];
  sourceFileRoles?: Record<string, string>;
}

interface CustomColumn {
  id: string;
  label: string;
}

function EditableCell({
  value,
  rowIndex,
  columnId,
  onChange,
  type = "text",
  className = "",
}: {
  value: string | number;
  rowIndex: number;
  columnId: string;
  onChange: (rowIndex: number, columnId: string, value: string | number) => void;
  type?: "text" | "number";
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      step={type === "number" ? "any" : undefined}
      onChange={(e) => {
        const newVal = type === "number" ? parseFloat(e.target.value) || 0 : e.target.value;
        onChange(rowIndex, columnId, newVal);
      }}
      className={`w-full bg-transparent text-center text-xs focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 ${className}`}
    />
  );
}

const BUILTIN_COLUMN_LABELS: Record<string, string> = {
  source_file: "Origen",
  contenedor: "CONTENEDOR",
  precinto: "PRECINTO",
  fam: "FAM",
  formato: "FORMATO",
  modelo: "MODELO",
  color: "COLOR",
  cal: "CAL",
  tono: "TONO",
  clbr: "CLBR",
  nro_palets: "NRO.PALETS",
  m2: "M2",
  piezas: "PIEZAS",
  cajas: "CAJAS",
  peso_neto: "PESO NETO",
  peso_bruto: "PESO BRUTO",
};

export function PackingTable({
  data,
  onChange,
  showSourceFile = false,
  sourceFileNames = [],
  sourceFileRoles = {},
}: PackingTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const [editingHeaderValue, setEditingHeaderValue] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setNewColName("");
      }
    }
    if (pickerOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [pickerOpen]);

  const handleCellChange = useCallback(
    (rowIndex: number, columnId: string, value: string | number) => {
      onChange(data.map((row, i) => (i !== rowIndex ? row : { ...row, [columnId]: value })));
    },
    [data, onChange]
  );

  const handleCustomCellChange = useCallback(
    (rowIndex: number, colId: string, value: string) => {
      onChange(
        data.map((row, i) =>
          i !== rowIndex
            ? row
            : { ...row, custom_fields: { ...row.custom_fields, [colId]: value } }
        )
      );
    },
    [data, onChange]
  );

  const handleDelete = useCallback(
    (rowIndex: number) => onChange(data.filter((_, i) => i !== rowIndex)),
    [data, onChange]
  );

  const handleAddRow = useCallback(() => {
    const customInit: Record<string, string> = {};
    customColumns.forEach((c) => (customInit[c.id] = ""));
    onChange([
      ...data,
      {
        id: makeRowId(),
        contenedor: data[data.length - 1]?.contenedor ?? "",
        precinto: data[data.length - 1]?.precinto ?? "",
        fam: "",
        formato: "",
        modelo: "",
        color: "",
        cal: "",
        tono: "",
        clbr: "0",
        nro_palets: 0,
        m2: 0,
        piezas: 0,
        cajas: 0,
        peso_neto: 0,
        peso_bruto: 0,
        source_file: "",
        custom_fields: customInit,
      },
    ]);
  }, [data, onChange, customColumns]);

  const handleAddCustomColumn = useCallback(() => {
    const name = newColName.trim();
    if (!name) return;
    const id = `custom_${Date.now()}`;
    setCustomColumns((prev) => [...prev, { id, label: name }]);
    onChange(data.map((row) => ({ ...row, custom_fields: { ...(row.custom_fields ?? {}), [id]: "" } })));
    setNewColName("");
    setColumnVisibility((prev) => ({ ...prev, [id]: true }));
  }, [newColName, data, onChange]);

  const handleRemoveCustomColumn = useCallback(
    (colId: string) => {
      setCustomColumns((prev) => prev.filter((c) => c.id !== colId));
      onChange(
        data.map((row) => {
          const cf = { ...(row.custom_fields ?? {}) };
          delete cf[colId];
          return { ...row, custom_fields: cf };
        })
      );
      setColumnVisibility((prev) => { const n = { ...prev }; delete n[colId]; return n; });
    },
    [data, onChange]
  );

  const handleRenameCustomColumn = useCallback(
    (colId: string, newLabel: string) => {
      setCustomColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, label: newLabel } : c)));
      setEditingHeaderId(null);
    },
    []
  );

  const sumCol = (key: keyof TableRow) =>
    (table: ReturnType<typeof useReactTable<TableRow>>) =>
      table.getFilteredRowModel().rows.reduce((s, r) => s + ((r.original[key] as number) || 0), 0);

  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      ...(showSourceFile
        ? [{
            accessorKey: "source_file",
            header: "ORIGEN",
            size: 100,
            enableHiding: true,
            cell: ({ row }: { row: Row<TableRow> }) => {
              const name = row.original.source_file ?? "";
              const slotIndex = sourceFileNames.indexOf(name);
              const label = sourceFileRoles[name] ?? name;
              const badgeStyle = slotIndex >= 0 ? BADGE_STYLES[slotIndex] : "bg-muted text-muted-foreground ring-1 ring-border";
              return label ? (
                <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${badgeStyle}`} title={name}>{label}</span>
              ) : <span className="text-xs text-muted-foreground">—</span>;
            },
            footer: () => null,
          } as ColumnDef<TableRow>]
        : []),
      {
        accessorKey: "contenedor",
        header: "CONTENEDOR",
        size: 105,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.contenedor} rowIndex={row.index} columnId="contenedor" onChange={handleCellChange} />,
        footer: () => null,
      },
      {
        accessorKey: "precinto",
        header: "PRECINTO",
        size: 105,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.precinto} rowIndex={row.index} columnId="precinto" onChange={handleCellChange} />,
        footer: () => null,
      },
      {
        accessorKey: "fam",
        header: "FAM",
        size: 50,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.fam} rowIndex={row.index} columnId="fam" onChange={handleCellChange} />,
        footer: () => <span className="font-bold text-xs">TOTALES</span>,
      },
      {
        accessorKey: "formato",
        header: "FORMATO",
        size: 110,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.formato} rowIndex={row.index} columnId="formato" onChange={handleCellChange} />,
        footer: () => null,
      },
      {
        accessorKey: "modelo",
        header: "MODELO",
        size: 110,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.modelo} rowIndex={row.index} columnId="modelo" onChange={handleCellChange} />,
        footer: () => null,
      },
      {
        accessorKey: "color",
        header: "COLOR",
        size: 80,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.color} rowIndex={row.index} columnId="color" onChange={handleCellChange} />,
        footer: () => null,
      },
      {
        accessorKey: "cal",
        header: "CAL",
        size: 50,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.cal} rowIndex={row.index} columnId="cal" onChange={handleCellChange} />,
        footer: () => null,
      },
      {
        accessorKey: "tono",
        header: "TONO",
        size: 65,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.tono} rowIndex={row.index} columnId="tono" onChange={handleCellChange} />,
        footer: () => null,
      },
      {
        accessorKey: "clbr",
        header: "CLBR",
        size: 45,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.clbr} rowIndex={row.index} columnId="clbr" onChange={handleCellChange} />,
        footer: () => null,
      },
      {
        accessorKey: "nro_palets",
        header: "NRO.PAL",
        size: 60,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.nro_palets} rowIndex={row.index} columnId="nro_palets" onChange={handleCellChange} type="number" />,
        footer: ({ table }) => {
          const t = table.getFilteredRowModel().rows.reduce((s, r) => s + (r.original.nro_palets || 0), 0);
          return <span className="font-bold text-xs">{t}</span>;
        },
      },
      {
        accessorKey: "m2",
        header: "M2",
        size: 65,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.m2} rowIndex={row.index} columnId="m2" onChange={handleCellChange} type="number" />,
        footer: ({ table }) => {
          const t = table.getFilteredRowModel().rows.reduce((s, r) => s + (r.original.m2 || 0), 0);
          return <span className="font-bold text-xs">{t.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: "piezas",
        header: "PIEZAS",
        size: 60,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.piezas} rowIndex={row.index} columnId="piezas" onChange={handleCellChange} type="number" />,
        footer: ({ table }) => {
          const t = table.getFilteredRowModel().rows.reduce((s, r) => s + (r.original.piezas || 0), 0);
          return <span className="font-bold text-xs">{t}</span>;
        },
      },
      {
        accessorKey: "cajas",
        header: "CAJAS",
        size: 60,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.cajas} rowIndex={row.index} columnId="cajas" onChange={handleCellChange} type="number" />,
        footer: ({ table }) => {
          const t = table.getFilteredRowModel().rows.reduce((s, r) => s + (r.original.cajas || 0), 0);
          return <span className="font-bold text-xs">{t}</span>;
        },
      },
      {
        accessorKey: "peso_neto",
        header: "PESO NETO",
        size: 80,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.peso_neto} rowIndex={row.index} columnId="peso_neto" onChange={handleCellChange} type="number" />,
        footer: ({ table }) => {
          const t = table.getFilteredRowModel().rows.reduce((s, r) => s + (r.original.peso_neto || 0), 0);
          return <span className="font-bold text-xs">{t.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>;
        },
      },
      {
        accessorKey: "peso_bruto",
        header: "PESO BRUTO",
        size: 85,
        enableHiding: true,
        cell: ({ row }) => <EditableCell value={row.original.peso_bruto} rowIndex={row.index} columnId="peso_bruto" onChange={handleCellChange} type="number" />,
        footer: ({ table }) => {
          const t = table.getFilteredRowModel().rows.reduce((s, r) => s + (r.original.peso_bruto || 0), 0);
          return <span className="font-bold text-xs">{t.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>;
        },
      },
      ...customColumns.map((col): ColumnDef<TableRow> => ({
        id: col.id,
        enableHiding: true,
        header: () =>
          editingHeaderId === col.id ? (
            <input
              autoFocus
              value={editingHeaderValue}
              onChange={(e) => setEditingHeaderValue(e.target.value)}
              onBlur={() => handleRenameCustomColumn(col.id, editingHeaderValue || col.label)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCustomColumn(col.id, editingHeaderValue || col.label);
                if (e.key === "Escape") setEditingHeaderId(null);
              }}
              className="w-full bg-transparent text-center text-xs focus:outline-none border-b border-white/40 pb-0.5"
              style={{ fontFamily: "var(--app-font-display)", letterSpacing: "0.08em" }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="cursor-pointer hover:opacity-70 transition-opacity" title="Doble clic para renombrar"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingHeaderId(col.id); setEditingHeaderValue(col.label); }}>
              {col.label}
            </span>
          ),
        size: 110,
        cell: ({ row }: { row: Row<TableRow> }) => (
          <input
            type="text"
            value={(row.original.custom_fields ?? {})[col.id] ?? ""}
            onChange={(e) => handleCustomCellChange(row.index, col.id, e.target.value)}
            className="w-full bg-transparent text-center text-xs focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5"
          />
        ),
        footer: () => null,
      })),
      {
        id: "actions",
        header: "",
        size: 36,
        enableHiding: false,
        cell: ({ row }: { row: Row<TableRow> }) => (
          <button onClick={() => handleDelete(row.index)} className="text-destructive hover:text-destructive/70 transition-colors p-1" title="Eliminar fila">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ),
        footer: () => null,
      },
    ],
    [handleCellChange, handleCustomCellChange, handleDelete, showSourceFile, sourceFileNames, sourceFileRoles, customColumns, editingHeaderId, editingHeaderValue, handleRenameCustomColumn, sumCol]
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  const builtinToggleable = table.getAllLeafColumns().filter((c) => c.getCanHide() && !c.id.startsWith("custom_"));
  const customToggleable = table.getAllLeafColumns().filter((c) => c.id.startsWith("custom_"));
  const hiddenCount = table.getAllLeafColumns().filter((c) => c.getCanHide() && !c.getIsVisible()).length;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-primary text-primary-foreground">
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-2 py-2.5 text-center font-semibold text-xs uppercase tracking-wider border-b border-white/10"
                    style={{ width: h.getSize(), fontFamily: "var(--app-font-display)", letterSpacing: "0.07em" }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="text-center py-16 text-muted-foreground">
                  No hay datos. Carga una factura o añade filas manualmente.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr key={row.id} className={`border-b border-border transition-colors hover:bg-muted/40 ${i % 2 === 0 ? "bg-card" : "bg-background"}`}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2 py-1.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              {table.getFooterGroups().map((fg) => (
                <tr key={fg.id} className="border-t-2 font-bold"
                  style={{ borderColor: "hsl(38 57% 54%)", background: "hsl(38 57% 54% / 0.06)" }}>
                  {fg.headers.map((h) => (
                    <td key={h.id} className="px-2 py-2.5 text-center" style={{ color: "hsl(38 57% 40%)" }}>
                      {flexRender(h.column.columnDef.footer, h.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <button onClick={handleAddRow}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-display uppercase"
          style={{ letterSpacing: "0.1em" }}>
          <PlusCircle className="w-3.5 h-3.5" />
          Añadir Fila
        </button>

        <div className="relative" ref={pickerRef}>
          <button onClick={() => setPickerOpen((o) => !o)}
            className={`flex items-center gap-1.5 text-xs transition-colors font-display uppercase ${pickerOpen || hiddenCount > 0 || customColumns.length > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            style={{ letterSpacing: "0.1em" }}>
            <Columns3 className="w-3.5 h-3.5" />
            Columnas
            {(hiddenCount > 0 || customColumns.length > 0) && (
              <span className="flex items-center justify-center text-white font-bold"
                style={{ fontSize: "9px", minWidth: "16px", height: "16px", background: "hsl(38 57% 54%)", borderRadius: "9999px", padding: "0 4px", letterSpacing: 0, fontFamily: "var(--app-font-sans)" }}>
                {customColumns.length > 0 ? `+${customColumns.length}` : hiddenCount}
              </span>
            )}
          </button>

          {pickerOpen && (
            <div className="absolute right-0 bottom-full mb-2 bg-card border border-border shadow-lg z-50"
              style={{ minWidth: "220px", maxHeight: "460px", overflowY: "auto" }}>
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-foreground uppercase" style={{ letterSpacing: "0.12em" }}>Columnas</span>
                <button onClick={() => builtinToggleable.forEach((c) => { if (!c.getIsVisible()) c.toggleVisibility(true); })}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">Mostrar todas</button>
              </div>
              <div className="py-1">
                {builtinToggleable.map((col) => {
                  const label = BUILTIN_COLUMN_LABELS[col.id] ?? col.id;
                  const isVis = col.getIsVisible();
                  return (
                    <button key={col.id} onClick={() => col.toggleVisibility(!isVis)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-xs hover:bg-muted/50 transition-colors">
                      <span className="flex items-center justify-center border shrink-0 transition-colors"
                        style={{ width: "14px", height: "14px", borderColor: isVis ? "hsl(38 57% 54%)" : "hsl(var(--border))", background: isVis ? "hsl(38 57% 54%)" : "transparent" }}>
                        {isVis && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className={isVis ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                    </button>
                  );
                })}
              </div>
              {customToggleable.length > 0 && (
                <>
                  <div className="px-4 py-2 border-t border-border">
                    <span className="text-xs font-display font-semibold text-muted-foreground uppercase" style={{ letterSpacing: "0.1em" }}>Personalizadas</span>
                  </div>
                  <div className="py-1">
                    {customToggleable.map((col) => {
                      const custom = customColumns.find((c) => c.id === col.id);
                      const label = custom?.label ?? col.id;
                      const isVis = col.getIsVisible();
                      return (
                        <div key={col.id} className="flex items-center gap-1 px-2 hover:bg-muted/50 transition-colors">
                          <button onClick={() => col.toggleVisibility(!isVis)} className="flex items-center gap-3 flex-1 py-2 text-left text-xs">
                            <span className="flex items-center justify-center border shrink-0 transition-colors"
                              style={{ width: "14px", height: "14px", borderColor: isVis ? "hsl(38 57% 54%)" : "hsl(var(--border))", background: isVis ? "hsl(38 57% 54%)" : "transparent" }}>
                              {isVis && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                            </span>
                            <span className={isVis ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                          </button>
                          <button onClick={() => handleRemoveCustomColumn(col.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar columna">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="px-3 py-3 border-t border-border space-y-2">
                <span className="text-xs font-display font-semibold text-muted-foreground uppercase block" style={{ letterSpacing: "0.1em" }}>Nueva columna</span>
                <div className="flex gap-1.5">
                  <input type="text" value={newColName} onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddCustomColumn(); }}
                    placeholder="Nombre de columna"
                    className="flex-1 text-xs border border-border bg-background px-2 py-1.5 focus:outline-none focus:border-foreground transition-colors"
                    style={{ minWidth: 0 }} />
                  <button onClick={handleAddCustomColumn} disabled={!newColName.trim()}
                    className="flex items-center justify-center text-white transition-colors disabled:opacity-30"
                    style={{ width: "28px", height: "28px", background: "hsl(38 57% 54%)", flexShrink: 0 }}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-muted-foreground" style={{ fontSize: "10px" }}>Doble clic en el encabezado para renombrar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
