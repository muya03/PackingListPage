import React, { useCallback, useRef, useState } from "react";
import { Upload, FileText, X, Plus, ArrowUpDown, AlertTriangle, ScanLine, FileSpreadsheet } from "lucide-react";
import type { SourceDocument, SourceKind } from "@/services/extraction";

interface UploadZoneProps {
  onFilesChanged: (files: SourceDocument[]) => void;
  disabled?: boolean;
}

const MAX_FILES = 3;
const MAX_SIZE_MB = 20;

export const FILE_ROLES = ["Packing List", "Factura Comercial", "Documento adicional"] as const;

const ACCEPTED = ".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp";

function detectKind(file: File): SourceKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt") || name.endsWith(".csv")) return "text";
  if (/\.(png|jpe?g|webp)$/.test(name)) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

const KIND_LABELS: Record<SourceKind, string> = {
  pdf: "PDF",
  docx: "Word",
  text: "Texto",
  image: "Imagen",
};

function defaultRole(index: number): string {
  return FILE_ROLES[index] ?? `Archivo ${index + 1}`;
}

function readFile(file: File, role: string, kind: SourceKind): Promise<SourceDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`No se ha podido leer "${file.name}".`));
    reader.onload = () => {
      const bytes = reader.result as ArrayBuffer;
      resolve({
        filename: file.name,
        role,
        kind,
        bytes,
        // Only scans and photos ever need the base64 payload, but keeping it
        // here means the AI fallback does not have to re-read the file.
        base64: kind === "image" || kind === "pdf" ? toBase64(bytes) : "",
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function UploadZone({ onFilesChanged, disabled }: UploadZoneProps) {
  const [files, setFiles] = useState<SourceDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback(
    (updated: SourceDocument[]) => {
      setFiles(updated);
      onFilesChanged(updated);
    },
    [onFilesChanged]
  );

  const processRawFiles = useCallback(
    async (rawFiles: File[], currentFiles: SourceDocument[]) => {
      setError(null);
      const remaining = MAX_FILES - currentFiles.length;
      if (remaining <= 0) {
        setError(`Máximo ${MAX_FILES} archivos. Elimina uno antes de añadir otro.`);
        return;
      }

      const toAdd = rawFiles.slice(0, remaining);
      const unsupported = toAdd.find((f) => detectKind(f) === null);
      if (unsupported) {
        setError(`"${unsupported.name}": formato no admitido. Usa PDF, DOCX, TXT/CSV o una imagen.`);
        return;
      }
      const tooLarge = toAdd.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
      if (tooLarge) {
        setError(`El archivo no puede superar los ${MAX_SIZE_MB} MB.`);
        return;
      }

      try {
        const entries = await Promise.all(
          toAdd.map((file, i) =>
            readFile(file, defaultRole(currentFiles.length + i), detectKind(file) as SourceKind)
          )
        );
        notify([...currentFiles, ...entries]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se han podido leer los archivos.");
      }
    },
    [notify]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      void processRawFiles(Array.from(e.dataTransfer.files), files);
    },
    [disabled, files, processRawFiles]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void processRawFiles(Array.from(e.target.files), files);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setError(null);
    notify(files.filter((_, i) => i !== index));
  };

  const changeRole = (index: number, role: string) => {
    notify(files.map((f, i) => (i === index ? { ...f, role } : f)));
  };

  const swapFiles = () => {
    if (files.length !== 2) return;
    const [a, b] = files;
    notify([
      { ...a, role: b.role },
      { ...b, role: a.role },
    ]);
  };

  const openPicker = () => {
    if (!disabled && files.length < MAX_FILES) inputRef.current?.click();
  };

  const canAddMore = files.length < MAX_FILES && !disabled;
  const duplicateRoles = new Set(files.map((f) => f.role)).size !== files.length;

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div
              key={f.filename + i}
              className="flex items-start gap-3 border border-border bg-muted/20 px-3 py-2"
            >
              {f.kind === "image" ? (
                <ScanLine className="w-4 h-4 shrink-0 mt-2" style={{ color: "hsl(38 57% 54%)" }} />
              ) : f.kind === "docx" ? (
                <FileSpreadsheet className="w-4 h-4 shrink-0 mt-2" style={{ color: "hsl(38 57% 54%)" }} />
              ) : (
                <FileText className="w-4 h-4 shrink-0 mt-2" style={{ color: "hsl(38 57% 54%)" }} />
              )}
              <div className="flex-1 min-w-0 space-y-1.5">
                {disabled ? (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.role}</p>
                ) : (
                  <select
                    value={f.role}
                    onChange={(e) => changeRole(i, e.target.value)}
                    className="text-xs font-semibold uppercase tracking-wide bg-transparent border border-border px-1.5 py-0.5 text-muted-foreground hover:border-foreground focus:outline-none focus:border-foreground cursor-pointer"
                    title="Cambiar rol del archivo"
                  >
                    {FILE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-sm font-medium text-foreground truncate" title={f.filename}>
                  {f.filename}
                  <span className="ml-2 text-xs text-muted-foreground">{KIND_LABELS[f.kind]}</span>
                </p>
                {f.kind === "image" && (
                  <p className="text-xs text-muted-foreground">
                    Una imagen no tiene texto: esta necesitará la lectura con IA.
                  </p>
                )}
              </div>
              {!disabled && (
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1.5"
                  title="Eliminar archivo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {files.length === 2 && !disabled && (
            <button
              onClick={swapFiles}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground py-1.5 transition-colors"
              title="Intercambiar los roles entre los dos archivos"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Intercambiar roles
            </button>
          )}

          {duplicateRoles && !disabled && (
            <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Hay archivos con el mismo rol. Asigna un rol distinto a cada uno.</span>
            </div>
          )}
        </div>
      )}

      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={openPicker}
          className={`relative border-2 border-dashed p-6 text-center transition-all duration-200 cursor-pointer ${
            isDragging ? "bg-muted/50" : "border-border hover:border-foreground/40 hover:bg-muted/30"
          }`}
          style={isDragging ? { borderColor: "hsl(38 57% 54%)" } : undefined}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={handleFileInput}
            disabled={disabled}
          />
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="p-3 bg-muted transition-colors">
                {files.length === 0 ? (
                  <Upload className="w-6 h-6 text-muted-foreground" />
                ) : (
                  <Plus className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
            </div>
            <div>
              {files.length === 0 ? (
                <>
                  <p className="font-semibold text-sm text-foreground">
                    Arrastra tus documentos aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF · Word · TXT/CSV · Imagen — hasta {MAX_FILES} archivos, máximo {MAX_SIZE_MB} MB c/u
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-sm text-foreground">Añadir {defaultRole(files.length)}</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF · Word · TXT/CSV · Imagen</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {files.length === MAX_FILES && !disabled && (
        <p className="text-xs text-muted-foreground text-center">
          {MAX_FILES} archivos cargados. Elimina uno para reemplazarlo.
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <X className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
