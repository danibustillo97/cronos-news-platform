"use client";

// Real job history for the "Buscar" tab -- GET /api/discovery/jobs,
// an endpoint that already existed but no UI consumed yet.

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { apiUrl } from "@/studio/lab/api-client";
import StatusPill from "./StatusPill";
import { DISCOVERY_JOB_STATUS } from "./statusMeta";

interface DiscoveryJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLING" | "CANCELLED";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  itemsFound: number | null;
  error: string | null;
}

function duration(startedAt: string | null, finishedAt: string | null): string | null {
  if (!startedAt || !finishedAt) return null;
  const seconds = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function whenLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = ms / 3_600_000;
  if (hours < 1) return `hace ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 24) return `hace ${hours.toFixed(1)} h`;
  return new Date(iso).toLocaleDateString();
}

export default function JobHistoryList({ refreshKey }: { refreshKey: number }) {
  const [jobs, setJobs] = useState<DiscoveryJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/discovery/jobs?limit=6"));
        if (res.ok) setJobs((await res.json()).jobs ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  if (loading) return null;
  if (jobs.length === 0) return null;

  return (
    <div className="pt-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold mb-1">Historial reciente</div>
      <div className="divide-y divide-white/5">
        {jobs.map((job) => {
          const meta = DISCOVERY_JOB_STATUS[job.status];
          const dur = duration(job.startedAt, job.finishedAt);
          return (
            <div key={job.id} className="flex items-center gap-2.5 py-2 text-xs">
              <StatusPill meta={meta} />
              <span className="text-neutral-500">{whenLabel(job.createdAt)}</span>
              {job.itemsFound !== null && <span className="text-neutral-400">{job.itemsFound} items</span>}
              {dur && <span className="text-neutral-600">{dur}</span>}
              {job.error && (
                <span className="flex items-center gap-1 text-red-400 truncate min-w-0" title={job.error}>
                  <AlertTriangle size={11} className="flex-shrink-0" /> <span className="truncate">{job.error}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
