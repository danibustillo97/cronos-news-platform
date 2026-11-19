'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useConsent } from './ConsentProvider'

export default function CookieConsent() {
  const pathname = usePathname()
  const { choice, setChoice } = useConsent()

  if (choice !== null || pathname.startsWith('/admin') || pathname === '/privacy') return null

  return (
    <aside
      role="dialog"
      aria-label="Preferencias de privacidad"
      className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-sm text-white shadow-2xl"
    >
      <p className="mb-3 text-neutral-200">
        Podemos usar almacenamiento local y tecnologías publicitarias según tu elección.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setChoice('accepted')}
          className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold text-neutral-950"
        >
          Aceptar
        </button>
        <button
          type="button"
          onClick={() => setChoice('rejected')}
          className="rounded-lg border border-neutral-600 px-4 py-2"
        >
          Rechazar
        </button>
        <Link href="/privacy" className="ml-auto text-xs text-neutral-400 underline">
          Política de privacidad
        </Link>
      </div>
    </aside>
  )
}
