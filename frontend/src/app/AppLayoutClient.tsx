"use client";

import { usePathname } from "next/navigation"
import { EditorWorkspaceProvider } from "@/context/EditorWorkspaceContext"
import { ProductionProvider } from "@/studio/lab/ProductionContext"
import GlobalWorkspaceOverlay from "@/components/admin/GlobalWorkspaceOverlay"
import { Toaster } from 'sonner'

function AdminOnlyProviders({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  // ProductionProvider fetches GET /api/productions and opens Supabase
  // Realtime subscriptions on mount -- real work the public site (and,
  // previously, every admin page load) doesn't need. Scoped to /admin
  // only, same boundary GlobalWorkspaceOverlay already uses below.
  if (!isAdmin) return <>{children}</>;
  return <ProductionProvider>{children}</ProductionProvider>;
}

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith("/admin")

  return (
    <EditorWorkspaceProvider>
      <AdminOnlyProviders isAdmin={isAdmin}>
        <Toaster position="top-center" richColors theme="dark" closeButton />
        {isAdmin && <GlobalWorkspaceOverlay />}
        {children}
      </AdminOnlyProviders>
    </EditorWorkspaceProvider>
  )
}
