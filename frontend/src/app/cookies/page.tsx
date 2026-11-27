import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Información sobre cookies y almacenamiento local en NEXUS News: sesiones, preferencias, analítica y publicidad.',
  alternates: { canonical: '/cookies' },
  robots: { index: false, follow: true },
}

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-neutral-200">
      <h1 className="mb-6 text-3xl font-bold">Política de Cookies</h1>
      <p className="mb-4">
        Esta página describe las tecnologías de almacenamiento usadas por Nexus News.
      </p>
      <h2 className="mt-8 text-xl font-semibold">Cookies esenciales</h2>
      <p className="mt-2">Las cookies de sesión pueden utilizarse para autenticar el panel administrativo y completar OAuth.</p>
      <h2 className="mt-8 text-xl font-semibold">Preferencias publicitarias y analíticas</h2>
      <p className="mt-2">
        AdSense, Adsterra y Google Analytics solo deben cargarse después de una elección válida del usuario,
        cuando la regulación aplicable exige consentimiento.
      </p>
      <h2 className="mt-8 text-xl font-semibold">Cambiar preferencias</h2>
      <p className="mt-2">
        Puedes borrar <code>cronos_ad_consent</code> desde el navegador para volver a mostrar el aviso.
      </p>
    </main>
  )
}
