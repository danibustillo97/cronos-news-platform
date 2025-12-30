"use client";
import React, { useState } from "react";
import { Save, Send, Globe, Layout, Sparkles, Eye, MoreHorizontal, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingEditorDockProps {
  status: string;
  setStatus: (status: string) => void;
  onSave: () => void;
  saving: boolean;
  onAIFormat?: () => void; // Future hook for "Intelligent" cleanup
}

export default function FloatingEditorDock({ 
  status, 
  setStatus, 
  onSave, 
  saving,
  onAIFormat 
}: FloatingEditorDockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isPublished = status === 'published';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-[#111] border border-white/10 rounded-full shadow-2xl shadow-black/50 p-2 flex items-center gap-2 backdrop-blur-xl">
        
        {/* Status Indicator / Toggle */}
        <div className="flex items-center bg-white/5 rounded-full px-1 py-1 border border-white/5">
          <button
            onClick={() => setStatus('draft')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${!isPublished ? 'bg-neutral-800 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Layout size={14} /> Draft
          </button>
          <button
            onClick={() => setStatus('published')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${isPublished ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Globe size={14} /> Live
          </button>
        </div>

        <div className="w-[1px] h-8 bg-white/10 mx-1"></div>

        {/* Main Actions */}
        <div className="flex items-center gap-2">
            
            {/* AI Magic Button (For future raw -> polished logic) */}
            <button 
                onClick={onAIFormat}
                className="p-3 rounded-full bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white transition-all group relative"
                title="AI Polish (Clean Raw Text)"
            >
                <Sparkles size={18} className="group-hover:animate-pulse" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    AI Polish
                </span>
            </button>

            {/* Quick Preview */}
            <button className="p-3 rounded-full bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-all">
                <Eye size={18} />
            </button>

            {/* Primary Save Action */}
            <button 
                onClick={onSave}
                disabled={saving}
                className="bg-white text-black pl-4 pr-5 py-2.5 rounded-full font-bold text-sm hover:scale-105 hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-white/10"
            >
                {saving ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></span>
                ) : (
                   isPublished ? <Send size={16} /> : <Save size={16} />
                )}
                {saving ? "Saving..." : (isPublished ? "Update Live" : "Save Draft")}
            </button>
        </div>

      </div>
    </div>
  );
}
