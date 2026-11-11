'use client'

// Toolbar horizontal contextual y genérico -- la pieza que permite que
// Deportes, Fútbol y cualquier categoría futura tengan su propio filtro
// sin agregar nada al navbar principal (ModernNavbar.tsx). Cada uso pasa
// sus propios `items`; el toolbar no sabe nada de deportes ni de
// categorías. Scroll horizontal en mobile (`scrollbar-hide`) en vez de
// wrap -- nunca rompe a dos líneas ni se aprieta.

export interface FilterToolbarItem {
  id: string
  label: string
  disabled?: boolean
}

export default function FilterToolbar({
  items, active, onChange, isDark, sticky = false,
}: {
  items: FilterToolbarItem[]
  active: string
  onChange: (id: string) => void
  isDark: boolean
  sticky?: boolean
}) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 overflow-x-auto scrollbar-hide border-b ${sticky ? 'sticky top-[56px] z-30 backdrop-blur' : ''} ${
        isDark ? 'border-white/10 bg-[#0B0B0B]/95' : 'border-[#E5E5E5] bg-white/95'
      }`}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={active === item.id}
          disabled={item.disabled}
          onClick={() => !item.disabled && onChange(item.id)}
          className={`flex-shrink-0 px-3.5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] whitespace-nowrap border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E30613] ${
            item.disabled
              ? isDark ? 'text-neutral-700 border-transparent cursor-default' : 'text-neutral-300 border-transparent cursor-default'
              : active === item.id
                ? 'border-[#E30613] text-[#E30613]'
                : isDark
                  ? 'border-transparent text-white/60 hover:text-white'
                  : 'border-transparent text-[#666] hover:text-[#161616]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
