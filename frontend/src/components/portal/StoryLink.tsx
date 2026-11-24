'use client'

// Enlace real a /noticia/[slug] (SEO, clic medio, "abrir en pestaña
// nueva") que, en un clic normal, abre la lectura en el modal del portal.

import type { MouseEvent, ReactNode } from 'react'
import type { NewsView } from '@/types/news'

export function StoryLink({
  story, onOpen, children, className = '', ariaLabel, onFocus, onMouseEnter,
}: {
  story: NewsView
  onOpen: (story: NewsView) => void
  children: ReactNode
  className?: string
  ariaLabel?: string
  onFocus?: () => void
  onMouseEnter?: () => void
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpen(story)
  }
  return (
    <a
      href={`/noticia/${story.slug}`}
      onClick={handleClick}
      onFocus={onFocus}
      onMouseEnter={onMouseEnter}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </a>
  )
}
