'use client'

// Perfil editorial de un creador -- no un perfil social. No hay tabla de
// creadores en el backend (confirmado): se deriva de `news.author` real,
// igual que /categoria/[slug] deriva de `news.category`. Sin
// seguidores/bio inventados -- solo lo que es real y verificable: sus
// publicaciones y cuántas son.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ModernNavbar from '@/components/ui/ModernNavbar'
import Footer from '@/components/layout/Footer'
import PostCard from '@/components/platform/PostCard'
import { slugifyName } from '@/components/platform/CreatorBadge'
import { newsToPost, type Post } from '@/lib/platform'
import { supabase } from '@/lib/supabaseClient'
import { usePortalTheme } from '@/context/ThemeContext'
import type { NewsView } from '@/types/news'

export default function CreatorProfilePage() {
  const { theme } = usePortalTheme()
  const isDark = theme === 'dark'
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[] | null>(null)

  useEffect(() => {
    supabase.from('news').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        const all = (data || []) as NewsView[]
        const mine = all.filter((n) => slugifyName(n.author || 'Nexus News') === params.slug)
        setPosts(mine.map((n) => newsToPost(n, all)))
      })
  }, [params.slug])

  const openPost = (post: Post) => router.push(`/noticia/${post.slug}`)

  const creator = posts && posts.length > 0 ? posts[0].creator : null
  const [lead, ...rest] = posts ?? []

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-[#0B0B0B] text-white' : 'bg-[#F7F7F5] text-[#161616]'}`}>
      <ModernNavbar />

      <main className="max-w-4xl mx-auto px-4 pt-8 pb-16">
        {posts === null ? (
          <p className="text-sm text-neutral-500">Cargando...</p>
        ) : !creator ? (
          <div className={`text-center py-24 border border-dashed ${isDark ? 'text-neutral-500 border-white/10' : 'text-[#999] border-[#E5E5E5]'}`}>
            <p className="mb-2">No encontramos publicaciones de este creador.</p>
            <Link href="/" className="text-[#E30613] font-semibold text-sm">← Volver al inicio</Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-10">
              <span className="w-16 h-16 rounded-full bg-[#E30613]/15 flex items-center justify-center text-2xl font-bold text-[#E30613] flex-shrink-0">
                {creator.initial}
              </span>
              <div>
                <h1 className="text-2xl font-black">{creator.name}</h1>
                <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-[#666]'}`}>
                  Creador de contenido{creator.specialty ? ` · ${creator.specialty}` : ''}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-[#999]'}`}>{creator.postCount} publicaciones</p>
              </div>
            </div>

            {lead && (
              <div className={`pb-8 mb-8 border-b ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`}>
                <p className={`text-xs font-bold uppercase tracking-[0.12em] mb-3 ${isDark ? 'text-white/60' : 'text-[#666]'}`}>Última cobertura</p>
                <PostCard post={lead} isDark={isDark} onOpen={openPost} variant="feature" />
              </div>
            )}

            {rest.length > 0 && (
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.12em] mb-4 ${isDark ? 'text-white/60' : 'text-[#666]'}`}>Publicaciones</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  {rest.map((post) => (
                    <PostCard key={post.id} post={post} isDark={isDark} onOpen={openPost} variant="compact" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
