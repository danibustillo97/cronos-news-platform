"use client";

import { usePathname } from "next/navigation"
import { ProductionProvider } from "@/studio/lab/ProductionContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { MediaPlayerProvider } from "@/context/MediaPlayerContext"
import MediaPlayerBar from "@/components/platform/MediaPlayerBar"
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

  // The light/dark toggle AND the persistent media player are
  // public-portal concepts only -- the admin app has its own fixed dark
  // design system, untouched here. MediaPlayerProvider lives above
  // ThemeProvider so the bar survives route changes across the whole
  // public site, not just within one page.
  if (isAdmin) return body
  return (
    <ThemeProvider>
      <MediaPlayerProvider>
        {body}
        <MediaPlayerBar />
      </MediaPlayerProvider>
    </ThemeProvider>
  )
}
