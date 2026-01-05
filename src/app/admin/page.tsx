"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminNewsManager from "@/components/admin/AdminNewsManager";
import SmartWorkspace from "@/components/admin/SmartWorkspace";
import AdminSeoTags from "@/components/admin/AdminSeoTags";
import { Bell, Search, Cpu, Wifi, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminPage() {
  const [activeView, setActiveView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin/login");
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <AdminDashboard />;
      case "news":
        return <SmartWorkspace />;
      case "tags_seo":
        return <AdminSeoTags />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-500">
            <Cpu size={64} className="mb-4 text-neutral-800 animate-pulse" />
            <p className="text-xl font-mono">Módulo en desarrollo...</p>
          </div>
        );
    }
  };

  const getPageTitle = () => {
    switch (activeView) {
      case "dashboard": return "Command Center";
      case "news": return "News Grid Control";
      case "tags_seo": return "SEO Intelligence";
      case "analytics": return "Real-time Analytics";
      case "settings": return "System Config";
      default: return "Nexus Admin";
    }
  };

  return (
    <div className="bg-[#050505] h-screen font-sans text-white flex overflow-hidden">
      {/* Sidebar */}
      <AdminSidebar activeView={activeView} setActiveView={setActiveView} />

      {/* Main Content */}
      <div className="flex-1 ml-20 md:ml-64 flex flex-col h-screen relative">
        
        {/* Background Ambient Glow */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-[150px]"></div>
        </div>

        {/* Top Header */}
        <header className="h-20 bg-black/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 px-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
             <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
               {getPageTitle()}
               <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-mono border border-red-500/20 uppercase tracking-widest">
                 Live
               </span>
             </h1>
          </div>

          <div className="flex items-center gap-6">
             {/* Global Search */}
             <div className="relative hidden lg:block group">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-blue-600 rounded-full blur opacity-20 group-hover:opacity-50 transition duration-500"></div>
               <div className="relative flex items-center">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-white transition-colors" size={16} />
                 <input 
                   type="text" 
                   placeholder="Search database..." 
                   className="bg-black border border-white/10 rounded-full py-2.5 pl-12 pr-6 text-sm w-72 text-white placeholder-neutral-600 focus:outline-none focus:border-white/30 transition-all shadow-xl"
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-600 border border-white/10 px-1.5 py-0.5 rounded bg-neutral-900">CMD+K</div>
               </div>
             </div>

             <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

             {/* Status Indicators */}
             <div className="flex items-center gap-4 text-neutral-400">
                <div className="flex items-center gap-2 text-xs font-mono">
                   <Wifi size={14} className="text-green-500" />
                   <span className="hidden xl:inline">Connected</span>
                </div>
                <button className="relative p-2 hover:text-white transition-colors">
                  <Bell size={20} />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></span>
                </button>
             </div>

             {/* Profile */}
             <div className="flex items-center gap-3 pl-4 border-l border-white/10 ml-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-neutral-800 to-neutral-700 p-[1px]">
                   <div className="w-full h-full bg-neutral-900 rounded-xl flex items-center justify-center text-xs font-bold text-white">
                      AI
                   </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut size={18} />
                </button>
             </div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <main className="flex-1 p-8 overflow-y-auto relative z-10 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeView}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
               className="h-full"
             >
               {renderContent()}
             </motion.div>
           </AnimatePresence>
        </main>

      </div>
    </div>
  );
}
