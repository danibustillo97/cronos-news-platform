"use client";

import { View } from "@/types/admin";

interface AdminSidebarProps {
    activeView: View;
    setActiveView: (view: View) => void;
}

export default function AdminSidebar({
    activeView,
    setActiveView,
}: AdminSidebarProps) {
    const items: { id: View; label: string }[] = [
        { id: "dashboard", label: "Command Center" },
        { id: "news", label: "Analysis Desk" },
        { id: "stories", label: "Stories" },
        { id: "social_gen", label: "Social Studio" },
        { id: "tags_seo", label: "SEO" },
    ];

    return (
        <aside className="fixed left-0 top-0 h-screen w-20 md:w-64 bg-black border-r border-white/10 flex flex-col">
            <div className="flex-1 flex flex-col gap-1 p-4">
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={`text-left px-4 py-2 rounded-lg text-sm transition ${activeView === item.id
                                ? "bg-red-500/10 text-red-500"
                                : "text-neutral-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </aside>
    );
}