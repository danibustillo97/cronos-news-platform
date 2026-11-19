"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3,
  CircleHelp, Clock3, Eye, Globe2, MousePointerClick, RefreshCw, Smartphone, Users,
} from "lucide-react";
import {
  getAnalyticsDashboard,
  type AnalyticsDashboard,
} from "@/lib/siteAnalytics";

type DateRange = 7 | 30;

const numberFormat = new Intl.NumberFormat("es-CO");
const regionNames = new Intl.DisplayNames(["es"], { type: "region" });

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

function formatRate(value: number): string {
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}

function percentageChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "0%" : "Nuevo";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${change.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}

function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function locationName(countryCode: string, regionCode: string): string {
  if (!regionCode) return countryName(countryCode);
  try {
    return regionNames.of(`${countryCode}-${regionCode}`) ?? `${countryName(countryCode)} · ${regionCode}`;
  } catch {
    return `${countryName(countryCode)} · ${regionCode}`;
  }
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-[18px] border border-white/[0.065] bg-[#0b0b0d] ${className}`}>
      {children}
    </section>
  );
}

function PanelHeading({
  icon,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[54px] items-center justify-between gap-3 border-b border-white/[0.055] px-3.5 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[10px] bg-white/[0.04] text-red-300">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[12px] font-medium text-neutral-100">{title}</h3>
          {detail && <p className="mt-0.5 truncate text-[9px] text-neutral-500">{detail}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function ChangeBadge({ current, previous }: { current: number; previous: number }) {
  const isPositive = current > previous;
  const isNeutral = current === previous;
  const Icon = isNeutral ? CircleHelp : isPositive ? ArrowUpRight : ArrowDownRight;
  const color = isNeutral
    ? "text-neutral-500"
    : isPositive
      ? "text-emerald-300"
      : "text-rose-300";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${color}`} title="Comparado con el periodo anterior">
      <Icon size={12} />
      {percentageChange(current, previous)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  previous,
  icon,
  accent = false,
  changeIsRate = false,
}: {
  label: string;
  value: number;
  previous: number;
  icon: React.ReactNode;
  accent?: boolean;
  changeIsRate?: boolean;
}) {
  return (
    <article className="group rounded-[16px] border border-white/[0.055] bg-[#0b0b0d] px-3.5 py-3 transition-colors hover:border-white/[0.1]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-neutral-500">{label}</p>
        <span className="flex h-6 w-6 items-center justify-center rounded-[9px] bg-white/[0.035] text-neutral-500 transition-colors group-hover:text-neutral-300">
          {icon}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p className={`text-[22px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${accent ? "text-red-200" : "text-neutral-100"}`}>
          {changeIsRate ? formatRate(value) : formatNumber(value)}
        </p>
        <ChangeBadge current={value} previous={previous} />
      </div>
    </article>
  );
}

function RankedList({
  rows,
  empty,
}: {
  rows: { label: string; value: number; detail?: string }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) {
    return <p className="px-4 py-7 text-center text-[11px] text-neutral-600">{empty}</p>;
  }
  return (
    <ol className="space-y-3 p-3.5">
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`} className="min-w-0">
          <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-4 flex-shrink-0 text-[9px] tabular-nums text-neutral-600">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] text-neutral-300" title={row.label}>{row.label}</span>
                {row.detail && <span className="mt-0.5 block truncate text-[9px] text-neutral-600" title={row.detail}>{row.detail}</span>}
              </span>
            </div>
            <span className="flex-shrink-0 text-[10px] tabular-nums text-neutral-400">{formatNumber(row.value)}</span>
          </div>
          <div className="ml-6 h-1 overflow-hidden rounded-full bg-white/[0.045]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-400/70 to-red-200/80"
              style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function DailyTrafficChart({ daily }: { daily: AnalyticsDashboard["daily"] }) {
  const max = Math.max(1, ...daily.map((day) => day.sessions));
  const labelIndexes = new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]);
  return (
    <div className="px-3.5 pb-3.5 pt-3.5 sm:px-4">
      {!daily.some((day) => day.sessions > 0) ? (
        <div className="flex h-[132px] items-center justify-center text-[10px] text-neutral-600">
          Las sesiones registradas aparecerán aquí.
        </div>
      ) : (
        <div className="flex h-[132px] items-end gap-[3px] sm:gap-1.5">
          {daily.map((day, index) => (
            <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <div className="relative flex h-[106px] w-full items-end justify-center">
                <div
                  className="w-full max-w-8 rounded-t-[5px] bg-gradient-to-t from-red-500/45 to-red-300/80 transition-[filter] group-hover:brightness-125"
                  style={{ height: `${Math.max(day.sessions > 0 ? 5 : 2, (day.sessions / max) * 96)}px` }}
                  title={`${day.date}: ${formatNumber(day.sessions)} sesiones · ${formatNumber(day.pageviews)} páginas vistas · ${formatNumber(day.clicks)} clics`}
                />
              </div>
              <span className={`mt-2 h-3 text-[8px] tabular-nums text-neutral-600 ${labelIndexes.has(index) ? "" : "invisible sm:visible"}`}>
                {day.date.slice(5)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t border-white/[0.045] pt-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
        <span className="text-[10px] text-neutral-500">Sesiones</span>
        <span className="ml-auto text-[10px] text-neutral-600">Pasa sobre cada día para ver el detalle</span>
      </div>
    </div>
  );
}

function AudiencePreview() {
  const metrics = [
    { label: "Sesiones", icon: <Users size={14} /> },
    { label: "Páginas vistas", icon: <Eye size={14} /> },
    { label: "Sesiones con clic", icon: <MousePointerClick size={14} /> },
    { label: "Tasa de sesiones con clic", icon: <BarChart3 size={14} /> },
  ];
  const panels = [
    { title: "Canales de llegada", detail: "Origen de las sesiones", icon: <ArrowRight size={15} /> },
    { title: "Dispositivos", detail: "Móvil, tableta y escritorio", icon: <Smartphone size={15} /> },
    { title: "Páginas más vistas", detail: "Contenido que consume tu audiencia", icon: <Eye size={15} /> },
    { title: "Acciones destacadas", detail: "Clics en enlaces y botones", icon: <MousePointerClick size={15} /> },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-[16px] border border-white/[0.055] bg-[#0b0b0d] px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium text-neutral-500">{metric.label}</p>
              <span className="flex h-6 w-6 items-center justify-center rounded-[9px] bg-white/[0.035] text-neutral-600">{metric.icon}</span>
            </div>
            <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.04em] text-neutral-700">—</p>
            <p className="mt-1.5 text-[9px] text-neutral-700">Sin datos</p>
          </article>
        ))}
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
        <Panel>
          <PanelHeading icon={<BarChart3 size={15} />} title="Tendencia de audiencia" detail="Sesiones y páginas vistas a lo largo del tiempo" />
          <div className="flex h-[132px] items-center justify-center px-5 text-center text-[10px] text-neutral-600">
            La tendencia aparecerá aquí cuando la captura esté activa.
          </div>
        </Panel>
        <Panel>
          <PanelHeading icon={<Globe2 size={15} />} title="Dónde está tu audiencia" detail="Ubicación aproximada por país y región" />
          <div className="flex h-[132px] flex-col items-center justify-center px-5 text-center">
            <Globe2 size={16} className="text-neutral-700" />
            <p className="mt-1.5 text-[10px] text-neutral-500">Sin ubicaciones registradas</p>
            <p className="mt-1 max-w-[230px] text-[9px] leading-relaxed text-neutral-700">Disponible al activar la medición en Vercel.</p>
          </div>
        </Panel>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        {panels.map((panel) => (
          <Panel key={panel.title}>
            <PanelHeading icon={panel.icon} title={panel.title} detail={panel.detail} />
            <p className="px-3.5 py-5 text-center text-[9px] text-neutral-700">Disponible al activar la medición.</p>
          </Panel>
        ))}
      </div>
    </>
  );
}

function AudienceAnalytics() {
  const [days, setDays] = useState<DateRange>(7);
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAnalyticsDashboard(days)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar las métricas.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [days, localRefreshKey]);

  const configuredError = error?.toLowerCase().includes("schema cache")
    || error?.toLowerCase().includes("could not find the function");
  const previousEngagementRate = data && data.previousSessions > 0
    ? (data.previousEngagedSessions / data.previousSessions) * 100
    : 0;
  const locationRows = useMemo(() => {
    if (!data) return [];
    if (data.topLocations.length) {
      return data.topLocations.map((item) => ({
        label: locationName(item.countryCode, item.regionCode),
        detail: countryName(item.countryCode),
        value: item.sessions,
      }));
    }
    return data.topCountries.map((item) => ({
      label: countryName(item.countryCode),
      value: item.sessions,
    }));
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-3 pb-5">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="text-[14px] font-medium tracking-tight text-neutral-100">Audiencia</h2>
          <span className="hidden h-4 border-l border-white/[0.1] sm:block" />
          <span className="text-[10px] text-neutral-500">
            {days} días <span className="text-neutral-700">·</span> vs. periodo anterior
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
            <div className="flex h-8 items-center gap-0.5 rounded-full border border-white/[0.075] bg-black/20 p-0.5">
              {([7, 30] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  aria-pressed={days === range}
                  onClick={() => setDays(range)}
                  className={`h-6 rounded-full px-2.5 text-[9px] font-medium transition-colors ${
                    days === range
                      ? "bg-white/[0.11] text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-200"
                  }`}
                >
                  {range} días
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLocalRefreshKey((key) => key + 1)}
              disabled={loading}
              aria-label="Actualizar analítica"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.075] bg-black/20 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
        </div>
      </div>

      {error ? (
        <>
          <Panel>
            <div role="status" className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] bg-white/[0.04] text-neutral-400">
                  <BarChart3 size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-neutral-200">
                    {configuredError ? "La medición aún no está activada" : "No pudimos cargar el informe"}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                    {configuredError
                      ? "Conecta el esquema de analítica en Supabase para empezar a registrar audiencia."
                      : "La solicitud falló. Vuelve a intentarlo; no mostraremos números incompletos."}
                  </p>
                  <details className="mt-2 text-[10px] text-neutral-600">
                    <summary className="w-fit cursor-pointer transition-colors hover:text-neutral-400">
                      {configuredError ? "Ver paso de activación" : "Ver detalle técnico"}
                    </summary>
                    <p className="mt-2 max-w-2xl break-words leading-relaxed">
                      {configuredError
                        ? <>Ejecuta <code className="text-neutral-400">infrastructure/database/supabase_setup/site_analytics_schema.sql</code> en el SQL Editor de Supabase.</>
                        : error}
                    </p>
                  </details>
                </div>
              </div>
              <span className="ml-12 w-fit flex-shrink-0 rounded-full border border-white/[0.07] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.12em] text-neutral-500 sm:ml-0">
                Sin datos
              </span>
            </div>
          </Panel>
          <AudiencePreview />
        </>
      ) : loading && !data ? (
        <Panel>
          <div className="px-5 py-12 text-center text-[12px] text-neutral-500">Preparando el informe de audiencia…</div>
        </Panel>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <MetricCard
              label="Sesiones"
              value={data.sessions}
              previous={data.previousSessions}
              icon={<Users size={14} />}
              accent
            />
            <MetricCard
              label="Páginas vistas"
              value={data.pageviews}
              previous={data.previousPageviews}
              icon={<Eye size={14} />}
            />
            <MetricCard
              label="Sesiones con interacción"
              value={data.engagedSessions}
              previous={data.previousEngagedSessions}
              icon={<MousePointerClick size={14} />}
            />
            <MetricCard
              label="Tasa de sesiones con clic"
              value={data.clickRate}
              previous={previousEngagementRate}
              icon={<BarChart3 size={14} />}
              changeIsRate
            />
          </div>

          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
            <Panel>
              <PanelHeading
                icon={<ActivityIcon />}
                title="Tendencia de audiencia"
                detail="Sesiones por día; cada barra incluye páginas vistas y clics"
                action={
                  <div className="mr-1 hidden items-center gap-2 text-[9px] text-neutral-500 sm:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-300" /> Sesiones
                  </div>
                }
              />
              <DailyTrafficChart daily={data.daily} />
              <div className="grid grid-cols-3 border-t border-white/[0.05]">
                <div className="px-4 py-3.5 sm:px-5">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-neutral-600">Vistas / sesión</p>
                  <p className="mt-1 text-[14px] font-semibold tabular-nums text-neutral-200">
                    {data.pagesPerSession.toLocaleString("es-CO", { maximumFractionDigits: 1 })}
                  </p>
                </div>
                <div className="border-x border-white/[0.05] px-4 py-3.5 sm:px-5">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-neutral-600">Clics registrados</p>
                  <p className="mt-1 text-[14px] font-semibold tabular-nums text-neutral-200">{formatNumber(data.clicks)}</p>
                </div>
                <div className="px-4 py-3.5 sm:px-5">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-neutral-600">Vs. anterior</p>
                  <div className="mt-1.5"><ChangeBadge current={data.sessions} previous={data.previousSessions} /></div>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeading
                icon={<Globe2 size={15} />}
                title="Dónde está tu audiencia"
                detail="Ubicación aproximada por país y región"
              />
              {locationRows.length ? (
                <>
                  <RankedList rows={locationRows} empty="" />
                  <p className="border-t border-white/[0.045] px-4 py-3 text-[9px] leading-relaxed text-neutral-600">
                    Ubicación aproximada derivada del país y región que entrega la plataforma. No almacenamos IP ni ubicación precisa.
                  </p>
                </>
              ) : (
                <div className="px-5 py-7 text-center">
                  <Globe2 size={17} className="mx-auto text-neutral-600" />
                  <p className="mt-2 text-[11px] text-neutral-500">Aún no hay ubicaciones disponibles.</p>
                  <p className="mt-1 text-[9px] leading-relaxed text-neutral-600">
                    La ubicación aproximada se completa cuando el sitio recibe visitas en Vercel.
                  </p>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-4">
            <Panel>
              <PanelHeading
                icon={<ArrowRight size={15} />}
                title="Canales de llegada"
                detail="Origen de las sesiones"
              />
              <RankedList
                rows={data.topReferrers.map((item) => ({ label: item.source, value: item.sessions }))}
                empty="Los canales aparecerán al llegar las primeras visitas."
              />
            </Panel>
            <Panel>
              <PanelHeading
                icon={<Smartphone size={15} />}
                title="Dispositivos"
                detail="Porcentaje de sesiones"
              />
              <RankedList
                rows={data.devices.map((item) => ({
                  label: item.device === "mobile" ? "Móvil" : item.device === "tablet" ? "Tableta" : "Escritorio",
                  value: item.sessions,
                  detail: `${data.sessions ? ((item.sessions / data.sessions) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 }) : 0}% de sesiones`,
                }))}
                empty="Aún no hay datos de dispositivos."
              />
            </Panel>
            <Panel>
              <PanelHeading
                icon={<Eye size={15} />}
                title="Páginas más vistas"
                detail="Qué está consumiendo la audiencia"
              />
              <RankedList
                rows={data.topPages.map((item) => ({
                  label: item.path,
                  value: item.pageviews,
                  detail: `${formatNumber(item.sessions)} sesiones`,
                }))}
                empty="Las páginas más vistas aparecerán aquí."
              />
            </Panel>
            <Panel>
              <PanelHeading
                icon={<MousePointerClick size={15} />}
                title="Acciones destacadas"
                detail="Clics en enlaces y botones"
              />
              <RankedList
                rows={data.topClicks.map((item) => ({
                  label: item.label,
                  value: item.clicks,
                  detail: item.targetPath ?? undefined,
                }))}
                empty="Las acciones de la audiencia aparecerán aquí."
              />
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Panel>
              <PanelHeading
                icon={<ArrowUpRight size={15} />}
                title="Campañas"
                detail="Sesiones atribuidas a etiquetas UTM"
              />
              <RankedList
                rows={data.topCampaigns.map((item) => ({
                  label: item.campaign,
                  value: item.sessions,
                  detail: item.source,
                }))}
                empty="Etiqueta tus enlaces con UTM para comparar campañas y adquisición."
              />
            </Panel>
            <div className="flex flex-col justify-center rounded-[22px] border border-white/[0.05] bg-white/[0.012] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                <Clock3 size={13} />
                Calidad de la medición
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-neutral-400">
                Una sesión es una visita temporal anónima. La comparación usa el periodo inmediatamente anterior del mismo tamaño.
                Los datos comienzan cuando se activa el esquema; no hay histórico previo.
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-neutral-600">
                No se guardan IP, perfiles de usuario, correos ni ubicación exacta. La geografía depende de las cabeceras disponibles en el despliegue.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ActivityIcon() {
  return <BarChart3 size={15} />;
}

export default function AdminDashboard() {
  return <AudienceAnalytics />;
}
