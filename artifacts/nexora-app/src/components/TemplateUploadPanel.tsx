import React, { useState, useRef, useCallback } from "react";
import { FileType2, Upload, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import PizZip from "pizzip";

const REQUIRED_PLACEHOLDERS = [
  "{invoice_reference}",
  "{invoice_date}",
  "{supplier_name}",
  "{client_name}",
  "{client_vat}",
  "{client_address}",
  "{total_units}",
  "{total_net}",
  "{total_gross}",
  "{total_cbm}",
  "{#items}",
  "{/items}",
  "{article_code}",
  "{product_description}",
  "{packing_type}",
  "{quantity_pieces}",
  "{packing_units}",
  "{dim_length_m}",
  "{dim_width_m}",
  "{dim_height_m}",
  "{net_weight_kg}",
  "{gross_weight_kg}",
  "{cbm}",
];

export interface CustomTemplate {
  name: string;
  buffer: ArrayBuffer;
}

interface TemplateUploadPanelProps {
  onTemplateChange: (template: CustomTemplate | null) => void;
  currentTemplate: CustomTemplate | null;
}

async function validateTemplate(buffer: ArrayBuffer): Promise<string[]> {
  const zip = new PizZip(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("El archivo no contiene un documento Word válido (word/document.xml no encontrado).");
  }
  const xml = docFile.asText();
  const missing: string[] = [];
  for (const placeholder of REQUIRED_PLACEHOLDERS) {
    if (!xml.includes(placeholder)) {
      missing.push(placeholder);
    }
  }
  return missing;
}

export function TemplateUploadPanel({ onTemplateChange, currentTemplate }: TemplateUploadPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setValidationError(null);
    setIsValidating(true);
    try {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        setValidationError("El archivo debe tener extensión .docx");
        return;
      }
      const buffer = await file.arrayBuffer();
      const missingPlaceholders = await validateTemplate(buffer);
      if (missingPlaceholders.length > 0) {
        setValidationError(
          `Faltan los siguientes marcadores obligatorios en la plantilla: ${missingPlaceholders.join(", ")}`
        );
        return;
      }
      onTemplateChange({ name: file.name, buffer });
      setIsOpen(false);
    } catch (e) {
      setValidationError(
        e instanceof Error ? e.message : "No se pudo leer el archivo."
      );
    } finally {
      setIsValidating(false);
    }
  }, [onTemplateChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleRemove = () => {
    onTemplateChange(null);
    setValidationError(null);
    setIsOpen(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${currentTemplate ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"}`}>
            <FileType2 className={`w-4 h-4 ${currentTemplate ? "text-blue-600" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Plantilla Word</p>
            {currentTemplate ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-blue-500" />
                {currentTemplate.name}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Usando plantilla NEXORA por defecto
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentTemplate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Eliminar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs"
          >
            {isOpen ? "Cerrar" : currentTemplate ? "Cambiar" : "Subir"}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-3 pt-4 border-t border-border">
          <div
            className={`relative border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/40"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleFileInput}
            />
            {isValidating ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">Validando plantilla...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 pointer-events-none">
                <Upload className="w-7 h-7 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Arrastra tu plantilla aquí</p>
                  <p className="text-xs text-muted-foreground mt-0.5">o haz clic para seleccionar un archivo .docx</p>
                </div>
              </div>
            )}
          </div>

          {validationError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">Marcadores obligatorios en la plantilla:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {REQUIRED_PLACEHOLDERS.map((p) => (
                <code key={p} className="text-xs bg-background border border-border rounded px-1 py-0.5 font-mono text-muted-foreground">
                  {p}
                </code>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Los marcadores de fila de tabla (<code className="font-mono">{"article_code"}</code>, etc.) deben ir dentro del bloque <code className="font-mono">{"#items"}…{"/items"}</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
