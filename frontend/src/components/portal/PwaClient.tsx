'use client'

// "Se siente como app": registra el service worker (solo en producción o
// con NEXT_PUBLIC_ENABLE_SW=1, para no interferir con `next dev`), ofrece
// instalar (Android: beforeinstallprompt; iOS Safari: pista única
// "Compartir → Añadir a pantalla de inicio") y, abierta como app
// instalada, muestra una barra de pestañas inferior.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Download, Home, Share, Table2, Trophy, User, Vote, X } from 'lucide-react'
import { safeStorage } from '@/lib/players'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = 'nexus.install.dismissed'
const SW_ENABLED = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1'

const TABS = [
  { href: '/', label: 'Inicio', icon: Home, match: (p: string) => p === '/' },
  { href: '/deportes/futbol?view=matches', label: 'Partidos', icon: Trophy, match: (p: string) => p === '/deportes/futbol' },
  { href: '/deportes/futbol/tabla', label: 'Tablas', icon: Table2, match: (p: string) => p.startsWith('/deportes/futbol/tabla') },
  { href: '/jugadores', label: 'Jugadores', icon: User, match: (p: string) => p.startsWith('/jugadores') },
  { href: '/encuestas', label: 'Encuestas', icon: Vote, match: (p: string) => p.startsWith('/encuestas') },
]

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

export default function PwaClient() {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const [standalone, setStandalone] = useState(false)
  // La barra de pestañas va siempre en teléfono (no solo con la app instalada).
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const tabs = standalone || phone
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (SW_ENABLED && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* sin SW el sitio funciona igual */ })
    }
    const sa = isStandalone()
    setStandalone(sa)
    let dismissed = false
    try { dismissed = safeStorage()?.getItem(DISMISS_KEY) === '1' } catch { /* bloqueado */ }
    if (sa || dismissed) return
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    if (isIosSafari()) setIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (tabs) root.style.setProperty('--nx-tabbar-h', 'calc(60px + env(safe-area-inset-bottom, 0px))')
    else root.style.removeProperty('--nx-tabbar-h')
    root.classList.toggle('nx-standalone', standalone)
    root.classList.toggle('nx-tabbar', tabs)
  }, [standalone, tabs])

  // Navegación con transición nativa (View Transitions) donde exista; respeta "menos movimiento".
  const go = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    try { navigator.vibrate?.(8) } catch { /* sin vibración */ }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (doc.startViewTransition && !reduce) doc.startViewTransition(() => router.push(href))
    else router.push(href)
  }

  const dismiss = () => {
    try { safeStorage()?.setItem(DISMISS_KEY, '1') } catch { /* bloqueado */ }
    setInstallEvent(null)
    setIosHint(false)
  }

  return (
    <>
      {(installEvent || iosHint) && (
        <div role="dialog" aria-label="Instalar NEXUS" className="fixed inset-x-3 bottom-[calc(var(--nx-tabbar-h,env(safe-area-inset-bottom,0px))+12px)] z-[85] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-[#141414]/95 p-3 text-white shadow-2xl backdrop-blur-md sm:left-auto sm:right-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FACC15] text-black">
            {installEvent ? <Download size={18} aria-hidden="true" /> : <Share size={18} aria-hidden="true" />}
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            {installEvent ? <><strong>Instala NEXUS</strong> y abre el fútbol como una app.</> : <>Para instalar: toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.</>}
          </p>
          {installEvent && (
            <button type="button" onClick={async () => { await installEvent.prompt(); await installEvent.userChoice.catch(() => null); dismiss() }} className="inline-flex min-h-[40px] shrink-0 items-center rounded-full bg-[#FACC15] px-4 text-sm font-bold text-black">
              Instalar app
            </button>
          )}
          <button type="button" onClick={dismiss} aria-label="Cerrar" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10"><X size={16} /></button>
        </div>
      )}

      {tabs && (
        <nav aria-label="Navegación de la app" className="fixed inset-x-0 bottom-0 z-[80] border-t border-white/10 bg-[#0A0A0A]/95 pb-[env(safe-area-inset-bottom,0px)] text-white backdrop-blur-md">
          <ul className="mx-auto flex h-[60px] max-w-lg items-stretch justify-around">
            {TABS.map(({ href, label, icon: Icon, match }) => {
              const on = match(pathname)
              return (
                <li key={href} className="flex-1">
                  <Link href={href} onClick={(e) => go(e, href)} aria-current={on ? 'page' : undefined} className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-transform active:scale-90 ${on ? 'text-[#FACC15]' : 'text-white/60'}`}>
                    <span className={`inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors ${on ? 'bg-[#FACC15]/15' : ''}`}><Icon size={21} aria-hidden="true" /></span>
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </>
  )
}
