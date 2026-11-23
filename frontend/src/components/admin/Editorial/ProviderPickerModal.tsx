"use client";

// Provider Control Plane -- the picker shown before starting a real
// Artifact job. Lists only the providers this backend actually
// implements (GET /api/artifact-providers, real, live-checked state --
// never a static/hardcoded list). A provider that isn't usable right now
// can't be selected; there is no client-side fallback logic here, the
// backend enforces the same rule again when the job is actually created.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, RefreshCw, CheckCircle2, AlertCircle, XCircle, Settings } from "lucide-react";
import { apiFetch } from "@/studio/lab/api-client";

interface ProviderInfo {
  id: string;
  label: string;
  kind: string;
  status: "CONNECTED" | "AVAILABLE" | "NOT_CONFIGURED" | "AUTH_ERROR" | "UNAVAILABLE" | "CHECKING";
  detail: string | null;
  version: string | null;
  isDefault: boolean;
  hasStoredKey: boolean;
}

const USABLE = new Set(["CONNECTED", "AVAILABLE"]);
// "Recordar" skips this dialog on the next sends (one click from Discovery to Artifact).
const REMEMBER_KEY = "nexus-artifact-provider";

function rememberedProvider(): string | null {
  try { return window.localStorage.getItem(REMEMBER_KEY); } catch { return null; }
}
function setRememberedProvider(value: string | null) {
  try {
    if (value) window.localStorage.setItem(REMEMBER_KEY, value);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // storage unavailable: the dialog simply keeps asking
  }
}

function StatusIcon({ status }: { status: ProviderInfo["status"] }) {
  if (status === "CONNECTED" || status === "AVAILABLE") return <CheckCircle2 size={14} className="text-green-400" />;
  if (status === "NOT_CONFIGURED") return <AlertCircle size={14} className="text-neutral-500" />;
  return <XCircle size={14} className="text-red-400" />;
}

const STATUS_LABEL: Record<ProviderInfo["status"], string> = {
  CONNECTED: "Conectado", AVAILABLE: "Disponible", NOT_CONFIGURED: "Sin configurar",
  AUTH_ERROR: "Error de autenticación", UNAVAILABLE: "No disponible", CHECKING: "Comprobando...",
};

export default function ProviderPickerModal({
  onConfirm, onCancel, onOpenSettings,
}: {
  onConfirm: (providerId: string) => void;
  onCancel: () => void;
  onOpenSettings?: () => void;
}) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/artifact-providers");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list: ProviderInfo[] = data.providers ?? [];
        setProviders(list);
        const usable = list.filter((p) => USABLE.has(p.status));
        const saved = rememberedProvider();
        const remembered = usable.find((p) => p.id === saved);
        if (remembered) {
          // Remembered and usable right now: send without asking (the toast offers to change it).
          toast.success(`Enviando con ${remembered.label}`, {
            action: { label: "Cambiar", onClick: () => { setRememberedProvider(null); toast.info("La próxima vez se preguntará el proveedor"); } },
          });
          confirmRef.current(remembered.id);
          return;
        }
        setSelected((usable.find((p) => p.isDefault) ?? usable[0])?.id ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los proveedores");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Redactar con IA</h3>
          <button onClick={onCancel} className="text-neutral-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Servicio de IA</div>

        {loading ? (
          <div className="flex items-center gap-2 text-neutral-400 text-sm py-4 justify-center">
            <RefreshCw className="animate-spin" size={16} /> Comprobando proveedores...
          </div>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => {
              const usable = USABLE.has(p.status);
              return (
                <button
                  key={p.id}
                  onClick={() => usable && setSelected(p.id)}
                  disabled={!usable}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    selected === p.id ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5"
                  } ${usable ? "hover:border-white/25 cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${selected === p.id ? "bg-white" : "bg-transparent border border-neutral-600"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-white font-medium">{p.label}</span>
                      {p.isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-400">Default</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StatusIcon status={p.status} />
                      <span className="text-[11px] text-neutral-500">{STATUS_LABEL[p.status]}</span>
                    </div>
                  </div>
                  {!usable && onOpenSettings && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
                      className="text-[10px] px-2 py-1 rounded bg-white/5 text-neutral-300 hover:bg-white/10 flex items-center gap-1 flex-shrink-0"
                    >
                      <Settings size={10} /> Configurar
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {error && <p role="alert" className="text-[11px] text-red-400">{error}</p>}

        <label className="flex items-center gap-2 text-[11px] text-neutral-400">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="accent-white" />
          Recordar y no volver a preguntar
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onCancel} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!selected) return;
              if (remember) setRememberedProvider(selected);
              onConfirm(selected);
            }}
            disabled={!selected}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Procesar
          </button>
        </div>
      </div>
    </div>
  );
}
