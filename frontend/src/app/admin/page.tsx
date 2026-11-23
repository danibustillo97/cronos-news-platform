"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminSeoTags from "@/components/admin/AdminSeoTags";
import AdminProviders from "@/components/admin/AdminProviders";
import AdminAds from "@/components/admin/AdminAds";
import NexusStudioView from "@/components/admin/NexusStudio/NexusStudioView";
import BroadcasterView from "@/components/admin/Broadcaster/BroadcasterView";
import EditorialView from "@/components/admin/Editorial/EditorialView";
import { DistributionView } from "@/components/admin/Distribution/DistributionView";
import { useProduction } from "@/studio/lab/ProductionContext";
import { useAdminSessionSync } from "@/lib/adminSession";

import { View } from "@/types/admin";

const NAVIGABLE_VIEWS: View[] = [
  "dashboard", "editorial", "nexus_studio", "broadcaster", "distribution", "tags_seo", "providers", "ads",
];

function isNavigableView(value: string | null): value is View {
  return value !== null && NAVIGABLE_VIEWS.includes(value as View);
}

export default function AdminPage() {
  const { activeView, setActiveView } = useProduction();
  useAdminSessionSync();
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const viewParam = url.searchParams.get("view");
    if (viewParam === "production" || viewParam === "social") {
      url.searchParams.delete("view");
      window.history.replaceState(window.history.state, "", url);
      return;
    }
    if (isNavigableView(viewParam)) setActiveView(viewParam);
    // Runs once on mount to honor supported deep links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeView === "production" || activeView === "social") setActiveView("dashboard");
  }, [activeView, setActiveView]);

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/admin/login");
        return;
      }
      setLoading(false);
    };
    bootstrap();
  }, [router]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
    if (error) {
      toast.error("No se pudo cerrar la sesión", { description: error.message });
      return;
    }
    router.push("/admin/login");
  };

  const visibleView = activeView === "production" || activeView === "social" ? "dashboard" : activeView;

  const pageTitle = useMemo(() => {
    switch (visibleView) {
      case "dashboard": return "Command Center";
      case "editorial": return "Editorial";
      case "nexus_studio": return "NEXUS Studio";
      case "broadcaster": return "";
      case "distribution": return "Distribución";
      case "tags_seo": return "SEO Intelligence";
      case "providers": return "Providers";
      case "ads": return "Publicidad";
      default: return "CRONOS";
    }
  }, [visibleView]);

  const renderContent = () => {
    switch (visibleView) {
      case "dashboard": return <AdminDashboard />;
      case "editorial": return <EditorialView />;
      case "nexus_studio": return <NexusStudioView />;
      case "broadcaster": return null; // rendered once, always mounted, outside this switch
      case "distribution": return <DistributionView />;
      case "tags_seo": return <AdminSeoTags />;
      case "providers": return <AdminProviders />;
      case "ads": return <AdminAds />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // 'editorial' needs it too now: Revisión is a real 3-column workspace
  // with its own independent per-column scroll (section 20) -- it can't
  // sit inside <main>'s page-level overflow-y-auto.
  const fullBleed = visibleView === "nexus_studio" || visibleView === "broadcaster" || visibleView === "distribution" || visibleView === "editorial";

  return (
    <div className="bg-[#050505] h-screen text-white overflow-hidden">
      <AdminSidebar
        activeView={visibleView}
        setActiveView={(view) => setActiveView(view as View)}
        onLogout={handleLogout}
      />

      <div className="flex flex-col h-screen overflow-hidden" style={{ marginLeft: 64, width: 'calc(100vw - 64px)' }}>
        {visibleView !== "nexus_studio" && (
          <AdminTopBar title={pageTitle} activeView={visibleView} />
        )}

        <main className={`min-h-0 flex-1 ${fullBleed ? 'overflow-hidden' : visibleView === "dashboard" ? 'p-3 sm:p-4 overflow-y-auto' : 'p-6 overflow-y-auto'}`}>
          {/* Always mounted: leaving the view must not cut a live broadcast or a recording. */}
          <div className={visibleView === "broadcaster" ? "h-full" : "hidden"}>
            <BroadcasterView active={visibleView === "broadcaster"} />
          </div>
          {visibleView === "broadcaster" || visibleView === "nexus_studio" ? (
            <div className={visibleView === "nexus_studio" ? "h-full" : "hidden"}><NexusStudioView /></div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={visibleView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className={fullBleed ? 'h-full flex flex-col' : undefined}
                style={fullBleed ? { height: '100%' } : undefined}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
