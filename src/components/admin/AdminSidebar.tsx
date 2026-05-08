"use client";

import React, { useState } from "react";
import {
    LayoutDashboard, FileText, Tags, BarChart2,
    Settings, Globe, Zap, Share2,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface AdminSidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
}

const ITEMS = [
    { id: "dashboard", label: "Command Center", icon: LayoutDashboard },
    { id: "news",      label: "News Grid",       icon: FileText },
    { id: "social",    label: "Content Studio",  icon: Share2 },
    { id: "tags_seo",  label: "SEO Intelligence", icon: Tags },
    { id: "analytics", label: "Live Analytics",  icon: BarChart2 },
    { id: "settings",  label: "System Config",   icon: Settings },
];

export default function AdminSidebar({ activeView, setActiveView }: AdminSidebarProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <motion.aside
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            animate={{ width: expanded ? 200 : 48 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-0 h-screen bg-[#080809] border-r border-white/[0.06] text-white flex flex-col z-50 overflow-hidden"
            style={{ willChange: 'width' }}
        >
            {/* ── brand ── */}
            <div className="flex items-center h-12 px-3 border-b border-white/[0.06] flex-shrink-0 overflow-hidden">
                {/* icon mark */}
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-600/30 rounded blur-sm" />
                        <Zap size={14} className="relative text-red-500 fill-current" />
                    </div>
                </div>

                <AnimatePresence>
                    {expanded && (
                        <motion.span
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            className="ml-2.5 font-black text-[13px] tracking-tight whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-500 select-none"
                        >
                            NEXUS<span className="text-red-600">OS</span>
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* ── nav ── */}
            <nav className="flex-1 py-3 px-1.5 space-y-0.5 overflow-hidden">
                {ITEMS.map(item => {
                    const isActive = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`relative w-full flex items-center h-8 rounded-lg transition-all duration-150 group overflow-hidden
                            ${isActive ? 'text-white' : 'text-neutral-600 hover:text-neutral-300'}`}
                            style={{ minWidth: 0 }}
                        >
                            {/* active bg */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeBg"
                                    className="absolute inset-0 bg-white/8 rounded-lg"
                                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                                />
                            )}

                            {/* icon */}
                            <span className="relative z-10 flex-shrink-0 flex items-center justify-center w-[45px]">
                                <item.icon
                                    size={15}
                                    className={`transition-colors ${isActive ? 'text-red-500' : 'group-hover:text-red-400'}`}
                                />
                            </span>

                            {/* label */}
                            <AnimatePresence>
                                {expanded && (
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.1 }}
                                        className="relative z-10 text-[12px] font-medium whitespace-nowrap truncate pr-3 select-none"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {/* active dot */}
                            {isActive && (
                                <motion.span
                                    layoutId="activeDot"
                                    className="absolute right-2 w-1 h-1 rounded-full bg-red-500 flex-shrink-0"
                                    style={{ opacity: expanded ? 1 : 0 }}
                                    transition={{ duration: 0.15 }}
                                />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* ── footer ── */}
            <div className="flex-shrink-0 px-1.5 pb-3 border-t border-white/[0.06] pt-2">
                <Link href="/">
                    <button className="w-full flex items-center h-8 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all group overflow-hidden">
                        <span className="flex-shrink-0 flex items-center justify-center w-[45px]">
                            <Globe size={14} className="group-hover:text-red-400 transition-colors" />
                        </span>
                        <AnimatePresence>
                            {expanded && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.1 }}
                                    className="text-[12px] font-medium whitespace-nowrap select-none"
                                >
                                    Ver Portal
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </Link>
            </div>
        </motion.aside>
    );
}
