'use client'

// Abstracción de posiciones de publicidad -- el resto del portal pide un
// AdSlot por POSICIÓN semántica ("dónde"), nunca un slotId de AdSense
// directamente ("con qué red/creativo"). Hoy el único provider real
// conectado es Google AdSense (vía AdSpace, ya usaba adsbygoogle real) --
// agregar Ad Manager/Prebid/patrocinio directo más adelante es cambiar
// SOLO este archivo, ningún call site.
//
// Reserva de espacio (minHeight) explícita por posición para no mover el
// layout cuando el anuncio carga (CLS) -- nunca "lo que sea que entre".

import AdSpace from './AdSpace'

export type AdPosition =
  | 'HOME_TOP' | 'HOME_MIDDLE' | 'HOME_FEED'
  | 'ARTICLE_TOP' | 'ARTICLE_MIDDLE' | 'ARTICLE_END'
  | 'SIDEBAR_DESKTOP' | 'MOBILE_FEED'

// Un único ad unit real de AdSense existe hoy (mismo en todo el portal
// actual) -- el mapa ya está listo para asignar unidades distintas por
// posición el día que existan en la cuenta de AdSense, sin tocar quien
// llama a <AdSlot position="...">.
const SLOT_ID_BY_POSITION: Record<AdPosition, string> = {
  HOME_TOP: '8962635274',
  HOME_MIDDLE: '8962635274',
  HOME_FEED: '8962635274',
  ARTICLE_TOP: '8962635274',
  ARTICLE_MIDDLE: '8962635274',
  ARTICLE_END: '8962635274',
  SIDEBAR_DESKTOP: '8962635274',
  MOBILE_FEED: '8962635274',
}

// minHeight reservado por posición -- formatos distintos reservan distinto
// espacio (un sidebar vertical no es del mismo alto que un banner nativo
// en el feed).
const MIN_HEIGHT_BY_POSITION: Record<AdPosition, number> = {
  HOME_TOP: 90, HOME_MIDDLE: 250, HOME_FEED: 250,
  ARTICLE_TOP: 90, ARTICLE_MIDDLE: 250, ARTICLE_END: 250,
  SIDEBAR_DESKTOP: 600, MOBILE_FEED: 250,
}

export default function AdSlot({ position, className = '' }: { position: AdPosition; className?: string }) {
  return (
    <div style={{ minHeight: MIN_HEIGHT_BY_POSITION[position] }} className={className} data-ad-position={position}>
      <AdSpace slotId={SLOT_ID_BY_POSITION[position]} />
    </div>
  )
}
