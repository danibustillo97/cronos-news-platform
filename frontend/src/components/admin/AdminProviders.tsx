"use client";

// Settings -> Providers. Real, live-checked state (GET /api/artifact-providers)
// -- never a static list. The API key is NEVER fetched or displayed in
// full: only whether one is stored (hasStoredKey), shown as a masked
// placeholder. Setting/replacing a key POSTs it once over HTTPS and it
// is never echoed back.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Sliders } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/studio/lab/api-client";

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

const STATUS_META: Record<ProviderInfo["status"], { label: string; color: string; icon: typeof CheckCircle2 }> = {
  CONNECTED: { label: "Connected", color: "text-green-400", icon: CheckCircle2 },
  AVAILABLE: { label: "Available", color: "text-green-400", icon: CheckCircle2 },
  NOT_CONFIGURED: { label: "Not configured", color: "text-neutral-500", icon: AlertCircle },
  AUTH_ERROR: { label: "Auth error", color: "text-red-400", icon: XCircle },
  UNAVAILABLE: { label: "Unavailable", color: "text-red-400", icon: XCircle },
  CHECKING: { label: "Checking...", color: "text-neutral-400", icon: RefreshCw },
};

export default function AdminProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/artifact-providers"));
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch {
      toast.error("No se pudo cargar el estado de los providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const testConnection = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch(apiUrl(`/api/artifact-providers/${id}/test`), { method: "POST" });
      const updated: ProviderInfo = await res.json();
      setProviders((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success(`${updated.label}: ${STATUS_META[updated.status].label}`);
    } catch {
      toast.error("No se pudo probar la conexión");
    } finally {
      setTesting(null);
    }
  };

  const setDefault = async (id: string) => {
    try {
      const res = await fetch(apiUrl("/api/artifact-providers/default"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: id }),
      });
      if (!res.ok) throw new Error();
      toast.success("Provider predeterminado actualizado");
      load();
    } catch {
      toast.error("No se pudo actualizar el provider predeterminado");
    }
  };

  const saveKey = async (id: string) => {
    const apiKey = keyDrafts[id]?.trim();
    if (!apiKey) return;
    setSavingKey(id);
    try {
      const res = await fetch(apiUrl(`/api/artifact-providers/${id}/api-key`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) throw new Error();
      setKeyDrafts((prev) => ({ ...prev, [id]: "" }));
      toast.success("API key guardada");
      load();
    } catch {
      toast.error("No se pudo guardar la API key");
    } finally {
      setSavingKey(null);
    }
  };

  const clearKey = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/artifact-providers/${id}/api-key`), { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("API key eliminada");
      load();
    } catch {
      toast.error("No se pudo eliminar la API key");
    }
  };

  const defaultProvider = providers.find((p) => p.isDefault);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-white/5 text-white rounded-xl border border-white/10">
          <Sliders size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Providers</h3>
          <p className="text-sm text-neutral-400">Motores de generación editorial para Artifact</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-neutral-400 py-8 justify-center">
          <RefreshCw className="animate-spin" size={18} /> Cargando...
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((p) => {
            const meta = STATUS_META[p.status];
            const Icon = meta.icon;
            return (
              <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{p.label}</span>
                      {p.isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-400">Default</span>}
                    </div>
                    <div className="text-[11px] text-neutral-500">{p.kind === "API" ? "API" : "Local CLI"}</div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
                    <Icon size={13} className={testing === p.id ? "animate-spin" : ""} /> {meta.label}
                  </div>
                </div>

                {p.detail && <p className="text-[11px] text-neutral-500">{p.detail}</p>}
                {p.version && <p className="text-[11px] text-neutral-600">Version: {p.version}</p>}

                {p.kind === "API" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-neutral-500">API Key</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder={p.hasStoredKey ? "••••••••••••••••••" : "Sin configurar"}
                        value={keyDrafts[p.id] ?? ""}
                        onChange={(e) => setKeyDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    onClick={() => testConnection(p.id)}
                    disabled={testing === p.id}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                  >
                    Test connection
                  </button>
                  {p.kind === "API" && (
                    <>
                      <button
                        onClick={() => saveKey(p.id)}
                        disabled={!keyDrafts[p.id]?.trim() || savingKey === p.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10 disabled:opacity-40"
                      >
                        {p.hasStoredKey ? "Replace key" : "Save key"}
                      </button>
                      {p.hasStoredKey && (
                        <button
                          onClick={() => clearKey(p.id)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                  {!p.isDefault && (
                    <button
                      onClick={() => setDefault(p.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-neutral-300 hover:bg-white/10 ml-auto"
                    >
                      Set as default
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div className="text-[11px] text-neutral-600">
          Provider predeterminado actual: {defaultProvider ? defaultProvider.label : "Automático (elige el primero disponible)"}
        </div>
      )}
    </div>
  );
}
