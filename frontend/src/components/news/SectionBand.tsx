import type { ReactNode } from 'react'

// Envuelve una sección con su propia identidad visual (fondo sutil +
// línea divisoria) -- nunca una "caja" con sombra/borde grueso, solo el
// cambio de fondo + el ritmo del contenido dentro. Cada sección que
// puede quedar vacía (sin datos reales) debe usar esto DESDE ADENTRO,
// solo en su rama de render con contenido -- nunca envolver desde el
// padre incondicionalmente, o un módulo oculto deja un hueco de color
// vacío en la página.
export default function SectionBand({
  bg, borderColor, children,
}: {
  bg: string
  borderColor: string
  children: ReactNode
}) {
  return (
    <div style={{ background: bg, borderTop: `1px solid ${borderColor}` }}>
      <div className="max-w-7xl mx-auto px-4 py-10">{children}</div>
    </div>
  )
}
