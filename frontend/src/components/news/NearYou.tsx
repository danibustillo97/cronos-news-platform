'use client'

// "Cerca de ti" -- señal editorial, no una obligación. Ubicación real
// resuelta server-side por IP (nunca pide permiso de GPS, ver
// backend/app/presentation/api/location.py); si no hay ubicación
// resoluble (común en desarrollo local, IP privada) o ninguna noticia
// real menciona esa ciudad/depto en tags/título, el módulo simplemente
// no se renderiza -- nunca cae a un "Colombia general" inventado desde
// contenido que no tiene relación real con el lugar.

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import EditorialImage from '@/components/news/EditorialImage'
import SectionBand from '@/components/news/SectionBand'
import { apiUrl } from '@/studio/lab/api-client'
import { proxiedImage } from '@/lib/media'
import type { NewsView } from '@/types/news'

interface LocationSignal {
  city: string
  region: string | null
  country: string | null
}

function matchesLocation(item: NewsView, signal: LocationSignal): boolean {
  const haystack = [item.title, item.category, ...(item.tags ?? [])].join(' ').toLowerCase()
  const needles = [signal.city, signal.region].filter(Boolean).map((s) => (s as string).toLowerCase())
  return needles.some((needle) => haystack.includes(needle))
}

export default function NearYou({
  news, isDark, onOpen,
}: {
  news: NewsView[]
  isDark: boolean
  onOpen: (item: NewsView) => void
}) {
  const [signal, setSignal] = useState<LocationSignal | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/location/resolve'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setSignal(data) })
      .catch(() => { if (!cancelled) setSignal(null) })
    return () => { cancelled = true }
  }, [])

  if (!signal) return null
  const local = news.filter((item) => matchesLocation(item, signal))
  if (local.length === 0) return null

  return (
    <SectionBand bg={isDark ? '#120D08' : '#FBF7F1'} borderColor={isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5'}>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-[#E30613]" />
          <h2 className={`text-xl font-serif font-bold ${isDark ? 'text-white' : 'text-[#161616]'}`}>Cerca de ti</h2>
          <span className={`text-sm ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
            {[signal.city, signal.region].filter(Boolean).join(', ')}
          </span>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-6">
          {local.slice(0, 3).map((item) => {
            const img = proxiedImage(item.image_url)
            return (
              <button key={item.id} onClick={() => onOpen(item)} className="col-span-4 group block text-left">
                <EditorialImage src={img} alt={item.title} sizes="(max-width: 768px) 100vw, 33vw" className="rounded-sm mb-2.5" />
                <span className="text-[#E30613] text-[10px] font-bold uppercase tracking-[0.14em]">{item.category || 'Noticia'}</span>
                <h3 className={`text-base font-bold leading-snug mt-1 group-hover:opacity-70 transition-opacity line-clamp-2 ${isDark ? 'text-white' : 'text-[#161616]'}`}>
                  {item.title}
                </h3>
              </button>
            )
          })}
        </div>
      </section>
    </SectionBand>
  )
}
