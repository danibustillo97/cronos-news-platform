'use client'

import { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🧠 Panel de Administración de Noticias</h1>
        {children}
      </div>
    </main>
  )
}
