import React, { useCallback, useRef, useState } from "react";
import { Upload, FileText, X, Plus, ArrowUpDown, AlertTriangle } from "lucide-react";
import type { PdfFile } from "@/services/openaiService";

interface UploadZoneProps {
  onFilesChanged: (files: PdfFile[]) => void;
  disabled?: boolean;
}

const MAX_FILES = 2;
const MAX_SIZE_MB = 20;

export const FILE_ROLES = ["Factura Comercial", "Packing List"] as const;

function defaultRole(index: number): string {
  return FILE_ROLES[index] ?? `Archivo ${index + 1}`;
}

export function UploadZone({ onFilesChanged, disabled }: UploadZoneProps) {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback(
    (updated: PdfFile[]) => {
      setFiles(updated);
      onFilesChanged(updated);
    },
    [onFilesChanged]
  );

  const processRawFiles = useCallback(
    (rawFiles: File[], currentFiles: PdfFile[]) => {
      setError(null);
      const remaining = MAX_FILES - currentFiles.length;
      if (remaining <= 0) {
        setError(`Máximo ${MAX_FILES} archivos. Elimina uno antes de añadir otro.`);
        return;
      }

      const toAdd = Array.from(rawFiles).slice(0, remaining);
      const invalidType = toAdd.find((f) => f.type !== "application/pdf");
      if (invalidType) {
        setError("Solo se aceptan archivos PDF.");
        return;
      }
      const tooLarge = toAdd.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
      if (tooLarge) {
        setError(`El archivo no puede superar los ${MAX_SIZE_MB} MB.`);
        return;
      }

      let processed = 0;
      const newEntries: PdfFile[] = [];

      toAdd.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64 = result.split(",")[1];
          const role = defaultRole(currentFiles.length + newEntries.length);
          newEntries.push({ base64, filename: file.name, role });
          processed++;
          if (processed === toAdd.length) {
            const merged = [...currentFiles, ...newEntries];
            notify(merged);
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [notify]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      processRawFiles(Array.from(e.dataTransfer.files), files);
    },
    [disabled, files, processRawFiles]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processRawFiles(Array.from(e.target.files), files);
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setError(null);
    notify(updated);
  };

  const changeRole = (index: number, role: string) => {
    const updated = files.map((f, i) => (i === index ? { ...f, role } : f));
    notify(updated);
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
    if (!disabled && files.length < MAX_FILES) {
      inputRef.current?.click();
    }
  };

  const canAddMore = files.length < MAX_FILES && !disabled;

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div
              key={f.filename + i}
              className="flex items-start gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10 px-3 py-2"
            >
              <FileText className="w-4 h-4 text-green-600 shrink-0 mt-2" />
              <div className="flex-1 min-w-0 space-y-1.5">
                {disabled ? (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {f.role}
                  </p>
                ) : (
                  <select
                    value={f.role}
                    onChange={(e) => changeRole(i, e.target.value)}
                    className="text-xs font-semibold uppercase tracking-wide bg-transparent border border-border rounded px-1.5 py-0.5 text-muted-foreground hover:border-primary/60 focus:outline-none focus:border-primary cursor-pointer"
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
                </p>
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
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/60 rounded-lg py-1.5 transition-colors"
              title="Intercambiar los roles entre los dos archivos"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Intercambiar roles
            </button>
          )}

          {files.length === 2 && files[0].role === files[1].role && !disabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Ambos archivos tienen el mismo rol (<strong>{files[0].role}</strong>). Asigna un rol distinto a cada uno para que la IA pueda procesarlos correctamente.
              </span>
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
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer
            ${isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/60 hover:bg-muted/30"}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={handleFileInput}
            disabled={disabled}
          />
          <div className="space-y-2">
            <div className="flex justify-center">
              <div
                className={`p-3 rounded-full transition-colors ${
                  isDragging ? "bg-primary/20" : "bg-muted"
                }`}
              >
                {files.length === 0 ? (
                  <Upload
                    className={`w-6 h-6 transition-colors ${
                      isDragging ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                ) : (
                  <Plus
                    className={`w-6 h-6 transition-colors ${
                      isDragging ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                )}
              </div>
            </div>
            <div>
              {files.length === 0 ? (
                <>
                  <p className="font-semibold text-sm text-foreground">
                    Arrastra tus PDFs aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Puedes subir hasta 2 PDFs · Factura + Packing List · Máximo {MAX_SIZE_MB} MB c/u
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-sm text-foreground">
                    Añadir {defaultRole(files.length)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Solo archivos PDF · Máximo {MAX_SIZE_MB} MB
                  </p>
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
