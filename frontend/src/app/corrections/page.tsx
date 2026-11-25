import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Correcciones',
  description: 'Consulta cómo NEXUS News recibe solicitudes de corrección, verifica información y registra cambios materiales en sus publicaciones deportivas.',
  alternates: { canonical: '/corrections' },
}

export default function CorrectionsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-neutral-200">
      <h1 className="mb-6 text-3xl font-bold">Política de Correcciones</h1>
      <p className="mb-4">
        Las correcciones materiales deberán conservar trazabilidad y indicar la modificación realizada.
      </p>
      <p>
        Solicitudes editoriales: el propietario debe configurar una dirección de contacto institucional.
      </p>
    </main>
  )
}
