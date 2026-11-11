"use client";

// Shared editorial-list row for Ready/Publish -- same wire-feed language
// as DiscoveryRow (no box, hairline separators, status dot, title
// dominant). Ready and Publish differ only in which actions they offer,
// so those stay panel-specific and are passed in as `children`.

import type { ReactNode } from "react";
import StatusPill from "./StatusPill";
import { ARTIFACT_STATUS } from "./statusMeta";

const DOT_TONE: Record<string, string> = {
  DRAFT: "bg-neutral-600",
  REVIEW_REQUIRED: "bg-amber-400",
  VALIDATED: "bg-blue-400",
  APPROVED: "bg-green-400",
  SCHEDULED: "bg-amber-400",
  REJECTED: "bg-red-400",
  PUBLISHED: "bg-green-400",
};

export default function ArtifactRow({
  version, status, categoryName, title, subtitle, excerpt, tags, rightAction, children,
}: {
  version: number;
  status: string;
  categoryName?: string | null;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  tags?: string[];
  rightAction?: ReactNode;
  children?: ReactNode;
}) {
  const meta = ARTIFACT_STATUS[status] ?? { label: status, tone: "neutral" as const };

  return (
    <article className="py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10.5px] text-neutral-500">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_TONE[status] ?? "bg-neutral-600"}`} />
            <span className="text-neutral-600">v{version}</span>
            <StatusPill meta={meta} />
            {categoryName && <span className="text-neutral-400 font-semibold truncate">{categoryName}</span>}
          </div>

          <h4 className="text-[14px] font-semibold text-white leading-snug mt-1">{title}</h4>
          {subtitle && <p className="text-[12.5px] text-neutral-400 mt-0.5">{subtitle}</p>}
          {excerpt && <p className="text-[12px] text-neutral-500 mt-1 line-clamp-2">{excerpt}</p>}

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
              {tags.map((t) => <span key={t} className="text-[10.5px] text-neutral-600">#{t}</span>)}
            </div>
          )}
        </div>
        {rightAction && <div className="flex-shrink-0 self-center">{rightAction}</div>}
      </div>

      {children}
    </article>
  );
}
