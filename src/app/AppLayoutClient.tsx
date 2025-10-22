"use client";
import RevolutionaryLayout from '@/components/RevolutionaryLayout'
import { usePathname } from "next/navigation"

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith("/admin")

  if (isAdmin) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-gray-100 flex items-center justify-center">
        <div className="w-full max-w-6xl mx-auto p-8 rounded-3xl shadow-2xl bg-black/90 backdrop-blur-xl border border-yellow-500/30">
          {children}
        </div>
      </main>
    )
  }

  return <RevolutionaryLayout>{children}</RevolutionaryLayout>
}
