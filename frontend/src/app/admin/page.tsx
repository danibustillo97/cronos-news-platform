"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Bell, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminSeoTags from "@/components/admin/AdminSeoTags";
import AdminProviders from "@/components/admin/AdminProviders";
import AdminAds from "@/components/admin/AdminAds";
import StudioView from "@/components/admin/Studio/StudioView";
import NexusStudioView from "@/components/admin/NexusStudio/NexusStudioView";
import EditorialView from "@/components/admin/Editorial/EditorialView";
import { ProductionWorkspace } from "@/components/admin/Production/ProductionWorkspace";
import { DistributionView } from "@/components/admin/Distribution/DistributionView";
import { useProduction } from "@/studio/lab/ProductionContext";

import { View } from "@/types/admin";

export default function AdminPage() {
  const { activeView, setActiveView, activeStory } = useProduction();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const viewParam = url.searchParams.get('view') as View | null;
    if (viewParam) setActiveView(viewParam);
    // Runs once on mount to honor a deep link (?view=social, etc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/admin/login");
        return;
      }
      setUser(data.session.user);
      setLoading(false);
    };
    bootstrap();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const pageTitle = useMemo(() => {
    switch (activeView) {
      case "dashboard": return "Command Center";
      case "editorial": return "Editorial";
      case "production": return "Producción";
      case "social": return "Studio (legacy)";
      case "nexus_studio": return "NEXUS Studio";
      case "distribution": return "Distribución";
      case "tags_seo": return "SEO Intelligence";
      case "providers": return "Providers";
      case "ads": return "Publicidad";
      default: return "CRONOS";
    }
  }, [activeView]);

  const renderContent = () => {
    switch (activeView) {
      case "dashboard": return <AdminDashboard />;
      case "editorial": return <EditorialView />;
      case "production": return <ProductionWorkspace />;
      case "social": return <StudioView />;
      case "nexus_studio": return <NexusStudioView />;
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
  const fullBleed = activeView === 'social' || activeView === 'nexus_studio' || activeView === 'production' || activeView === 'distribution' || activeView === 'editorial';

  return (
    <div className="bg-[#050505] h-screen text-white overflow-hidden">
      <AdminSidebar
        activeView={activeView}
        setActiveView={(view) => setActiveView(view as View)}
      />

      <div className="flex flex-col h-screen overflow-hidden" style={{ marginLeft: 48, width: 'calc(100vw - 48px)' }}>
        <header className={`border-b border-white/10 px-6 flex items-center justify-between bg-black/60 backdrop-blur flex-shrink-0 ${activeView === 'social' || activeView === 'nexus_studio' ? 'hidden' : 'h-14'}`}>
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-[15px] font-bold tracking-tight">
              {pageTitle}
            </h1>

            {activeStory?.title && (
              <>
                <span className="text-neutral-700">/</span>
                <span className="text-[12px] text-neutral-400 truncate max-w-[360px]">{activeStory.title}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-5 flex-shrink-0">
            <span className="flex items-center gap-1.5 text-[10px] text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              live
            </span>
            <Bell size={16} className="text-neutral-500" />
            <button onClick={handleLogout} className="text-neutral-500 hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className={`min-h-0 flex-1 ${fullBleed ? 'overflow-hidden' : 'p-6 overflow-y-auto'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
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
        </main>
      </div>
    </div>
  );
}
