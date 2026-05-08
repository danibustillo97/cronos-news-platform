"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Bell, Search, Cpu, Wifi, LogOut, Facebook, Twitter, Instagram, Youtube, Linkedin, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import SmartWorkspace from "@/components/admin/SmartWorkspace";
import AdminSeoTags from "@/components/admin/AdminSeoTags";
import SocialMediaGenerator from "@/components/admin/SocialMedia/SocialMedia";

import { View, AnalysisMode } from "@/types/admin";

export default function AdminPage() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("noris");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const router = useRouter();

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
      case "dashboard":
        return "Command Center";
      case "news":
        return "Analysis Desk";
      case "social":
        return "Content Studio";
      case "tags_seo":
        return "SEO Intelligence";
      default:
        return "Nexus Admin";
    }
  }, [activeView]);

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <AdminDashboard />;

      case "news":
        return (
          <SmartWorkspace />
        );

      case "social":
        return <SocialMediaGenerator />;

      case "tags_seo":
        return <AdminSeoTags />;

      default:
        return (
          <div className="flex items-center justify-center h-[60vh] text-neutral-500">
            <Cpu size={64} className="text-neutral-800" />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#050505] h-screen text-white flex overflow-hidden">
      <AdminSidebar
        activeView={activeView}
        setActiveView={(view) => setActiveView(view as View)}
      />

      <div className="flex flex-col h-screen overflow-hidden" style={{ marginLeft: 48 }}>
        <header className={`border-b border-white/10 px-8 flex items-center justify-between bg-black/60 backdrop-blur flex-shrink-0 ${activeView === 'social' ? 'hidden' : 'h-20'}`}>
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-black tracking-tight">
              {pageTitle}
            </h1>

            {activeView === "news" && (
              <div className="flex gap-2">
                {(["noris", "breaking", "opinion", "data"] as AnalysisMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      onClick={() => setAnalysisMode(mode)}
                      className={`px-3 py-1 rounded-full text-xs uppercase tracking-widest ${analysisMode === mode
                        ? "bg-red-500/10 text-red-500 border border-red-500/30"
                        : "text-neutral-400 border border-white/10 hover:text-white"
                        }`}
                    >
                      {mode}
                    </button>
                  )
                )}
              </div>
            )}

            <div className="flex items-center gap-3 ml-8">
              <Facebook size={16} className="text-blue-500 cursor-pointer hover:text-blue-400" onClick={() => setActiveView("social")} />
              <Twitter size={16} className="text-blue-400 cursor-pointer hover:text-blue-300" onClick={() => setActiveView("social")} />
              <Instagram size={16} className="text-pink-500 cursor-pointer hover:text-pink-400" onClick={() => setActiveView("social")} />
              <Youtube size={16} className="text-red-500 cursor-pointer hover:text-red-400" onClick={() => setActiveView("social")} />
              <Linkedin size={16} className="text-blue-600 cursor-pointer hover:text-blue-500" onClick={() => setActiveView("social")} />
              <MessageCircle size={16} className="text-black cursor-pointer hover:text-gray-700" onClick={() => setActiveView("social")} />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Wifi size={16} className="text-green-500" />
            <Bell size={18} />
            <button onClick={handleLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className={`min-h-0 flex-1 ${activeView === 'social' ? 'overflow-hidden' : 'p-8 overflow-y-auto'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={activeView === 'social' ? 'h-full flex flex-col' : undefined}
              style={activeView === 'social' ? { height: '100%' } : undefined}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}