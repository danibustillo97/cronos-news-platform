"use client";

import { usePathname } from "next/navigation"
import { ProductionProvider } from "@/studio/lab/ProductionContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { Toaster } from 'sonner'

function AdminOnlyProviders({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  // ProductionProvider fetches GET /api/productions and opens Supabase
  // Realtime subscriptions on mount -- real work the public site doesn't
  // need. Scoped to /admin only.
  if (!isAdmin) return <>{children}</>;
  return <ProductionProvider>{children}</ProductionProvider>;
}

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith("/admin")

  const body = (
    <AdminOnlyProviders isAdmin={isAdmin}>
      <Toaster position="top-center" richColors theme="dark" closeButton />
      {children}
    </AdminOnlyProviders>
  )

  // The light/dark toggle is a public-portal concept only -- the admin
  // app has its own fixed dark design system, untouched here.
  return isAdmin ? body : <ThemeProvider>{body}</ThemeProvider>
}
