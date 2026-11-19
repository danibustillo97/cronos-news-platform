"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { startClickTracking, trackPageView } from "@/lib/siteAnalytics";

export default function PublicAnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname === lastPath.current) return;
    lastPath.current = pathname;
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => startClickTracking(), []);

  return null;
}
