'use client'

// El bloque más importante de la portada: grid editorial asimétrico.
// Lead = LIVE SLOT (destacado editorial normalmente, se transforma solo
// si hay algo real en vivo -- ver LiveSlot.tsx). Columna secundaria =
// PostCard feature + 2 compactas -- ya no tiene tarjetas propias
// (ProminentCard/CompactCard quedaban obsoletas en cuanto PostCard
// existió, ver consolidación 2026-09-24).

import LiveSlot, { pickMatch } from '@/components/platform/LiveSlot'
import PostCard from '@/components/platform/PostCard'
import { newsToPost } from '@/lib/platform'
import type { NewsView } from '@/types/news'
import type { Match } from '@/types/sports'

export default function FrontPage({
  featured, secondary, matches, isDark, onOpen,
}: {
  featured: NewsView
  secondary: NewsView[]
  matches: Match[]
  isDark: boolean
  onOpen: (item: NewsView) => void
}) {
  const posts = secondary.map((n) => newsToPost(n, secondary))
  const [first, second, third] = posts
  const hasMatch = Boolean(pickMatch(matches))
  const openPost = (post: ReturnType<typeof newsToPost>) => onOpen(post.source)

  return (
    <section className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-4 lg:gap-6">
      <div className={`col-span-4 md:col-span-8 ${hasMatch ? 'lg:col-span-12' : 'lg:col-span-7'}`}>
        <LiveSlot matches={matches} featured={featured} isDark={isDark} onOpen={onOpen} />
      </div>

      <div className={`col-span-4 md:col-span-8 ${hasMatch ? 'lg:col-span-12 grid gap-4 md:grid-cols-3' : 'lg:col-span-5 flex flex-col gap-4'}`}>
        {first && <PostCard post={first} isDark={isDark} onOpen={openPost} variant={hasMatch ? 'card' : 'compact'} />}
        {second && <PostCard post={second} isDark={isDark} onOpen={openPost} variant={hasMatch ? 'card' : 'compact'} />}
        {third && <PostCard post={third} isDark={isDark} onOpen={openPost} variant={hasMatch ? 'card' : 'compact'} />}
      </div>
    </section>
  )
}
