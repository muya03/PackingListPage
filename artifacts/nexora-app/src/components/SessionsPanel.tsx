import React, { useState, useEffect, useCallback } from "react";
import { History, Save, Trash2, Loader2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TableRow, InvoiceMeta } from "@/types/packing";

const API_BASE = `${import.meta.env.BASE_URL}api`;

interface SessionSummary {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface SessionFull extends SessionSummary {
  meta: InvoiceMeta;
  rows: TableRow[];
}

interface SessionsPanelProps {
  tableRows: TableRow[];
  meta: InvoiceMeta;
  onRestoreSession: (rows: TableRow[], meta: InvoiceMeta) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionsPanel({ tableRows, meta, onRestoreSession }: SessionsPanelProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [error, setError] = useState("");

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      if (!res.ok) throw new Error("Error al cargar sesiones");
      const data: SessionSummary[] = await res.json();
      setSessions(data);
    } catch {
      setError("No se pudieron cargar las sesiones.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchSessions();
  }, [isOpen, fetchSessions]);

  const handleSave = async () => {
    if (!sessionName.trim()) return;
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sessionName.trim(), meta, rows: tableRows }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setSessionName("");
      await fetchSessions();
    } catch {
      setError("No se pudo guardar la sesión.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async (id: number) => {
    setRestoringId(id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`);
      if (!res.ok) throw new Error("Error al restaurar");
      const session: SessionFull = await res.json();
      onRestoreSession(session.rows, session.meta);
      setIsOpen(false);
    } catch {
      setError("No se pudo restaurar la sesión.");
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (id: number, e: React.SyntheticEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("No se pudo eliminar la sesión.");
    } finally {
      setDeletingId(null);
    }
  };

  const hasData = tableRows.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setIsOpen((o) => !o)}
      >
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Sesiones Guardadas
          {sessions.length > 0 && (
            <span className="ml-1 bg-primary/10 text-primary text-xs font-medium rounded-full px-2 py-0.5">
              {sessions.length}
            </span>
          )}
        </h2>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {hasData && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Guarda el estado actual con un nombre:</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 text-sm bg-background border border-input rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  placeholder={meta.invoice_reference || "Nombre de la sesión..."}
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  disabled={isSaving}
                />
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!sessionName.trim() || isSaving}
                  className="shrink-0"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-xs">Cargando...</span>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              No hay sesiones guardadas todavía.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    className="w-full flex items-start justify-between gap-2 rounded-lg border border-border bg-background hover:bg-muted/50 px-3 py-2 text-left transition-colors group disabled:opacity-60"
                    onClick={() => handleRestore(s.id)}
                    disabled={restoringId === s.id || deletingId === s.id}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 shrink-0" />
                        {formatDate(s.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {restoringId === s.id && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Eliminar sesión"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all text-muted-foreground"
                        onClick={(e) => handleDelete(s.id, e)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleDelete(s.id, e); }}
                      >
                        {deletingId === s.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
