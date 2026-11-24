'use client'

// Lee el layout de Portada (GET /api/portal/layout, mismo origen vía el
// proxy de Next). Sin endpoint / con error -> DEFAULT_LAYOUT. En modo
// `?preview=1` (iframe del admin) re-consulta cada 5 s y además acepta
// borradores por postMessage (mismo origen): mientras llegan borradores
// se pausa el polling y se reanuda 15 s después del último.

import { useCallback, useEffect, useRef, useState } from 'react'
import { PORTAL_MSG_READY, type PortalLayout, type PortalScrollTarget } from '@/types/portal'
import { defaultLayout, layoutSignature, normalizeLayout, parsePortalMessage } from '@/lib/portalLayout'

const PREVIEW_POLL_MS = 5_000
const PUBLIC_POLL_MS = 60_000
const DRAFT_HOLD_MS = 15_000
const FIRST_LOAD_TIMEOUT_MS = 2_500

export function usePortalLayout(onScrollTo?: (target: PortalScrollTarget) => void) {
  const [layout, setLayout] = useState<PortalLayout>(defaultLayout)
  const [ready, setReady] = useState(false)
  const [preview, setPreview] = useState(false)
  const signature = useRef(layoutSignature(defaultLayout()))
  const lastDraftAt = useRef(0)
  const scrollRef = useRef(onScrollTo)
  scrollRef.current = onScrollTo

  const apply = useCallback((next: PortalLayout) => {
    const sig = layoutSignature(next)
    if (sig === signature.current) return
    signature.current = sig
    setLayout(next)
  }, [])

  useEffect(() => {
    const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'
    setPreview(isPreview)
    let cancelled = false

    const load = async (timeoutMs: number) => {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch('/api/portal/layout', { cache: 'no-store', signal: controller.signal })
        if (!res.ok) throw new Error(String(res.status))
        const json: unknown = await res.json()
        // Un borrador que llegó mientras esta request viajaba tiene prioridad.
        if (!cancelled && Date.now() - lastDraftAt.current >= DRAFT_HOLD_MS) apply(normalizeLayout(json))
      } catch {
        // Sin endpoint o caído: se conserva el último layout válido (al inicio, el default).
      } finally {
        window.clearTimeout(timer)
        if (!cancelled) setReady(true)
      }
    }

    load(FIRST_LOAD_TIMEOUT_MS)
    const id = window.setInterval(() => {
      if (Date.now() - lastDraftAt.current < DRAFT_HOLD_MS) return
      if (!isPreview && document.visibilityState !== 'visible') return
      load(8_000)
    }, isPreview ? PREVIEW_POLL_MS : PUBLIC_POLL_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [apply])

  useEffect(() => {
    if (!preview) return
    const onMessage = (event: MessageEvent) => {
      const msg = parsePortalMessage(event.origin, window.location.origin, event.data)
      if (!msg) return
      if (msg.type === 'layout') {
        lastDraftAt.current = Date.now()
        apply(msg.layout)
        setReady(true)
      } else {
        scrollRef.current?.(msg.target)
      }
    }
    window.addEventListener('message', onMessage)
    const announce = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: PORTAL_MSG_READY }, window.location.origin)
      }
    }
    if (document.readyState === 'complete') announce()
    else window.addEventListener('load', announce, { once: true })
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('load', announce)
    }
  }, [preview, apply])

  return { layout, ready, preview }
}
