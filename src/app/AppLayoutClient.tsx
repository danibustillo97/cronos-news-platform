"use client";

import { usePathname } from "next/navigation"
import { EditorWorkspaceProvider } from "@/context/EditorWorkspaceContext"
import GlobalWorkspaceOverlay from "@/components/admin/GlobalWorkspaceOverlay"
import { Toaster } from 'sonner'

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith("/admin")

  return (
    <EditorWorkspaceProvider>
      <Toaster position="top-center" richColors theme="dark" closeButton />
      {isAdmin && <GlobalWorkspaceOverlay />}
      {children}
    </EditorWorkspaceProvider>
  )
}
