// Insignia de formato -- la señal visual mínima de qué tipo de
// publicación es (artículo, foto, video, audio, en vivo, galería,
// datos). Nunca decorativa sola: el formato real del Post decide el
// ícono, nunca al revés.

import { BarChart3, FileText, Images, Mic, Radio, Video } from 'lucide-react'
import type { PostFormat } from '@/lib/platform'

const CONFIG: Record<PostFormat, { icon: typeof FileText; label: string }> = {
  article: { icon: FileText, label: 'Noticia' },
  photo: { icon: Images, label: 'Fotografía' },
  video: { icon: Video, label: 'Video' },
  audio: { icon: Mic, label: 'Audio' },
  live: { icon: Radio, label: 'En vivo' },
  gallery: { icon: Images, label: 'Galería' },
  data: { icon: BarChart3, label: 'Datos' },
  mixed: { icon: FileText, label: 'Cobertura' },
}

export default function FormatBadge({ format }: { format: PostFormat }) {
  const { icon: Icon, label } = CONFIG[format] ?? CONFIG.article
  const live = format === 'live'
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] ${live ? 'text-[#E30613]' : 'text-neutral-500'}`}>
      <Icon size={11} className={live ? 'animate-pulse' : ''} />
      {label}
    </span>
  )
}
