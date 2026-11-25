import type { Metadata } from 'next'
import Link from 'next/link'
import PortalPage from '@/components/portal/PortalPage'
import { supabase } from '@/lib/supabaseClient'
import { isCurrentNews } from '@/lib/newsFreshness'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Archivo de noticias deportivas',
  description: 'Consulta el archivo de NEXUS News: noticias deportivas publicadas, contexto y cobertura de la Liga BetPlay y el fútbol internacional que siguen disponibles después del ciclo de actualidad.',
  alternates: { canonical: '/archivo' },
}

type ArchiveItem = {
  slug: string
  title: string
  summary: string | null
  excerpt: string | null
  category: string | null
  published_at: string
}

function plainText(value: string | null | undefined): string {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default async function ArchivePage() {
  const { data, error } = await supabase
    .from('news')
    .select('slug,title,summary,excerpt,category,published_at')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(500)

  const archive = ((data ?? []) as ArchiveItem[])
    .filter((item) => item.slug && item.published_at && !isCurrentNews(item))
    .slice(0, 100)

  const dateFormat = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })

  return (
    <PortalPage>
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <header className="mb-8 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">Hemeroteca NEXUS</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--nx-ink)]">Archivo de noticias deportivas</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--nx-ink-2)]">
            Consulta historias publicadas sobre la Liga BetPlay y el fútbol de Colombia y el mundo. Las noticias dejan el feed de actualidad al cumplir su ciclo editorial, pero sus artículos y enlaces permanentes siguen disponibles en este archivo.
          </p>
        </header>

        {error ? (
          <p role="status" className="rounded-xl border border-[var(--nx-line)] p-5 text-sm text-[var(--nx-muted)]">
            El archivo no está disponible en este momento. Vuelve a intentarlo más tarde.
          </p>
        ) : archive.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--nx-line-strong)] p-8 text-center text-sm text-[var(--nx-muted)]">
            Todavía no hay noticias fuera del ciclo de actualidad.
          </p>
        ) : (
          <>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--nx-muted)]">
              {archive.length} historias archivadas
            </p>
            <ol className="grid gap-4 md:grid-cols-2">
              {archive.map((item) => {
                const description = plainText(item.summary || item.excerpt)
                return (
                  <li key={item.slug} className="min-w-0 rounded-2xl border border-[var(--nx-line)] bg-[var(--nx-surface)] p-5">
                    <article>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--nx-accent-text)]">
                        {item.category || 'Deportes'}
                      </p>
                      <h2 className="mt-2 text-lg font-bold leading-snug text-[var(--nx-ink)]">
                        <Link href={`/noticia/${encodeURIComponent(item.slug)}`} className="hover:text-[var(--nx-accent-text)]">
                          {item.title}
                        </Link>
                      </h2>
                      <time dateTime={item.published_at} className="mt-3 block text-xs text-[var(--nx-muted)]">
                        {dateFormat.format(new Date(item.published_at))}
                      </time>
                      {description && (
                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--nx-ink-2)]">
                          {description}
                        </p>
                      )}
                    </article>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </main>
    </PortalPage>
  )
}
