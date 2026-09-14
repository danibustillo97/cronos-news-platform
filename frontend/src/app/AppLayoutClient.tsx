"use client";

import { usePathname } from "next/navigation"
import { EditorWorkspaceProvider } from "@/context/EditorWorkspaceContext"
import { ProductionProvider } from "@/studio/lab/ProductionContext"
import GlobalWorkspaceOverlay from "@/components/admin/GlobalWorkspaceOverlay"
import { Toaster } from 'sonner'

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith("/admin")

  return (
    <EditorWorkspaceProvider>
      <ProductionProvider>
        <Toaster position="top-center" richColors theme="dark" closeButton />
        {isAdmin && <GlobalWorkspaceOverlay />}
        {children}
      </ProductionProvider>
    </EditorWorkspaceProvider>
  )
}
