'use client'

import { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-50 text-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-200">
          <h1 className="text-4xl font-semibold mb-6 tracking-tight text-gray-800">
            🧠 Panel de Administración de Noticias
          </h1>
          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
