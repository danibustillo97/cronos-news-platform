"use client";

import React, { useState } from "react";
import {
    LayoutDashboard, Tags, Film, Radio, Globe, Compass, Sliders, Megaphone, RadioTower, LogOut,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface AdminSidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
    onLogout: () => void;
    /** Phones: the sidebar is a drawer opened from the top bar. */
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

// "editorial" is the ONE editorial space (Discovery/Ready/Publish live
// as internal tabs of EditorialView, never as separate sidebar entries --
// Discovery is the first phase of Editorial, not a module outside it).
// News (manual article CRUD) was removed -- Editorial fully replaced it.
const ITEMS = [
    { id: "dashboard",    label: "Command Center", icon: LayoutDashboard },
    { id: "editorial",    label: "Editorial",      icon: Compass },
    { id: "nexus_studio", label: "NEXUS Studio",   icon: Film },
    { id: "broadcaster",  label: "Broadcaster",    icon: RadioTower },
    { id: "distribution", label: "Distribución",   icon: Radio },
    { id: "tags_seo",     label: "SEO",            icon: Tags },
    { id: "providers",    label: "Providers",      icon: Sliders },
    { id: "ads",          label: "Publicidad",     icon: Megaphone },
];

export default function AdminSidebar({ activeView, setActiveView, onLogout, mobileOpen = false, onMobileClose }: AdminSidebarProps) {
    const [hovered, setHovered] = useState(false);
    const expanded = hovered || mobileOpen;

    return (
        <>
        {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden" onClick={onMobileClose} aria-hidden />}
        <motion.aside
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            animate={{ width: expanded ? 184 : 52 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed left-2 top-2 bottom-2 rounded-[20px] border border-white/[0.08] bg-[#0b0b0d]/95 text-white shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl ${mobileOpen ? "flex" : "hidden md:flex"} flex-col z-50 overflow-hidden`}
            style={{ willChange: "width" }}
        >
            {/* ── nav ── */}
            <nav aria-label="Navegación del administrador" className="flex-1 py-3 px-1.5 space-y-1 overflow-hidden">
                {ITEMS.map(item => {
                    const isActive = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setActiveView(item.id); onMobileClose?.(); }}
                            aria-label={item.label}
                            aria-current={isActive ? "page" : undefined}
                            title={!expanded ? item.label : undefined}
                            className={`relative w-full flex items-center h-10 rounded-xl transition-colors duration-200 group overflow-hidden
                            ${isActive ? "text-white" : "text-neutral-500 hover:text-neutral-200"}`}
                            style={{ minWidth: 0 }}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeBg"
                                    className="absolute inset-0 rounded-xl border border-white/[0.07] bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
                                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                                />
                            )}

                            <span className={`relative z-10 ml-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] transition-colors ${
                                isActive ? "text-yellow-300" : "group-hover:text-yellow-300"
                            }`}>
                                <item.icon
                                    size={16}
                                    strokeWidth={isActive ? 2 : 1.8}
                                />
                            </span>

                            <AnimatePresence>
                                {expanded && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -5 }}
                                        transition={{ duration: 0.14 }}
                                        className={`relative z-10 ml-2 min-w-0 flex-1 truncate pr-3 text-[12px] whitespace-nowrap select-none ${
                                            isActive ? "font-medium text-white" : "font-normal"
                                        }`}
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </button>
                    );
                })}
            </nav>

            {/* ── footer ── */}
            <div className="flex-shrink-0 px-1.5 pb-2 pt-2 border-t border-white/[0.06]">
                <button
                    type="button"
                    onClick={onLogout}
                    aria-label="Cerrar sesión"
                    title={!expanded ? "Cerrar sesión" : undefined}
                    className="mb-1 w-full flex items-center h-10 rounded-xl text-neutral-500 hover:text-yellow-200 hover:bg-yellow-300/[0.08] transition-colors group overflow-hidden"
                >
                    <span className="ml-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] group-hover:text-yellow-300">
                        <LogOut size={16} strokeWidth={1.8} />
                    </span>
                    <AnimatePresence>
                        {expanded && (
                            <motion.span
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -5 }}
                                transition={{ duration: 0.14 }}
                                className="ml-2 text-[12px] whitespace-nowrap select-none"
                            >
                                Cerrar sesión
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
                <Link href="/">
                    <button
                        aria-label="Ver Portal"
                        title={!expanded ? "Ver Portal" : undefined}
                        className="w-full flex items-center h-10 rounded-xl text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04] transition-colors group overflow-hidden"
                    >
                        <span className="ml-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] group-hover:text-yellow-300">
                            <Globe size={16} strokeWidth={1.8} />
                        </span>
                        <AnimatePresence>
                            {expanded && (
                                <motion.span
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -5 }}
                                    transition={{ duration: 0.14 }}
                                    className="ml-2 text-[12px] whitespace-nowrap select-none"
                                >
                                    Ver Portal
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </Link>
            </div>
        </motion.aside>
        </>
    );
}
