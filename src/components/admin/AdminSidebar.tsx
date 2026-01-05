"use client";
import { 
  LayoutDashboard, 
  FileText, 
  Tags, 
  BarChart2, 
  Settings, 
  Globe, 
  Zap,
  Smartphone,
  Share2
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface AdminSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export default function AdminSidebar({ activeView, setActiveView }: AdminSidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Command Center", icon: LayoutDashboard },
    { id: "news", label: "News Grid", icon: FileText },
    { id: "stories", label: "TikTok Stories", icon: Smartphone },
    { id: "social_gen", label: "Social Studio", icon: Share2 },
    { id: "tags_seo", label: "SEO Intelligence", icon: Tags },
    { id: "analytics", label: "Live Analytics", icon: BarChart2 },
    { id: "settings", label: "System Config", icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 md:w-64 bg-black/90 backdrop-blur-xl border-r border-white/10 text-white flex flex-col z-50 transition-all duration-300">
      {/* Brand */}
      <div className="p-6 flex items-center justify-center md:justify-start gap-3 border-b border-white/10">
        <div className="relative group cursor-pointer">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative w-10 h-10 bg-black rounded-lg flex items-center justify-center border border-white/10">
            <Zap className="text-red-500" size={24} fill="currentColor" />
          </div>
        </div>
        <span className="font-black text-xl tracking-tighter hidden md:block bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-500">
          NEXUS<span className="text-red-600">OS</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-8 px-3 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 group overflow-hidden ${
              activeView === item.id
                ? "text-white"
                : "text-neutral-500 hover:text-white"
            }`}
          >
            {activeView === item.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white/10 border border-white/5 rounded-xl"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <item.icon size={22} className={`relative z-10 transition-colors ${activeView === item.id ? "text-red-500" : "group-hover:text-red-400"}`} />
            <span className="relative z-10 hidden md:block">{item.label}</span>
            
            {/* Active Dot */}
            {activeView === item.id && (
               <motion.div 
                 layoutId="activeDot"
                 className="absolute right-3 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] hidden md:block"
               />
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 bg-black/50 backdrop-blur-md">
        <Link href="/">
          <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-red-900 hover:to-red-800 border border-white/10 text-neutral-300 hover:text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-lg group">
            <Globe size={16} className="group-hover:animate-pulse" />
            <span className="hidden md:inline">Ver Portal</span>
          </button>
        </Link>
      </div>
    </aside>
  );
}
