import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Key, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "nexora_openai_api_key";

interface SettingsPanelProps {
  onApiKeyChange: (key: string) => void;
}

export function SettingsPanel({ onApiKeyChange }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      onApiKeyChange(stored);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem(STORAGE_KEY, apiKey.trim());
    onApiKeyChange(apiKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setIsOpen(false);
    }, 1200);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey("");
    onApiKeyChange("");
    setIsOpen(true);
  };

  const stored = !!localStorage.getItem(STORAGE_KEY);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${stored ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
            <Key className={`w-4 h-4 ${stored ? "text-green-600" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Clave de API OpenAI (opcional)</p>
            {stored && !isOpen ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                Clave configurada correctamente
              </p>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-muted-foreground" />
                Solo para escaneos y verificación
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stored && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
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
            {isOpen ? "Cerrar" : stored ? "Cambiar" : "Configurar"}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-3 pt-4 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="api-key-input" className="text-xs font-medium">
              Clave API
            </Label>
            <div className="relative">
              <Input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                placeholder="sk-proj-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            La extracción normal no usa IA: se hace en tu navegador leyendo el PDF o el Word. Esta clave solo se
            necesita para leer fotos o escaneos sin texto y para el botón «Verificar con IA». Se guarda únicamente en
            este navegador y no se envía a ningún servidor salvo a OpenAI.
          </p>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="w-full"
          >
            {saved ? (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Guardado
              </span>
            ) : (
              "Guardar clave"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
