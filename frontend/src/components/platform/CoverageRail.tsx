'use client'

// "Cobertura": agrupa un partido real con las publicaciones reales que
// de verdad lo mencionan (ver lib/platform.ts::buildCoverage -- match de
// texto contra título, nunca una relación inventada). Así el usuario
// sigue un acontecimiento sin saltar entre secciones. Si ninguna
// publicación real corresponde a ningún partido, este componente no
// tiene nada que mostrar y el padre no lo monta.

import Image from 'next/image'
import PostCard from '@/components/platform/PostCard'
import type { Coverage, Post } from '@/lib/platform'

export default function CoverageRail({ coverage, isDark, onOpen }: { coverage: Coverage; isDark: boolean; onOpen: (post: Post) => void }) {
  const { match } = coverage

  return (
    <div className={`border ${isDark ? 'border-white/10' : 'border-[#E5E5E5]'}`}>
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-[#E5E5E5] bg-[#FAFAFA]'}`}>
        {match.homeLogo && <Image src={match.homeLogo} alt="" width={18} height={18} className="object-contain" />}
        <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-[#161616]'}`}>{coverage.title}</span>
        {match.awayLogo && <Image src={match.awayLogo} alt="" width={18} height={18} className="object-contain" />}
        <span className={`ml-auto text-[10px] font-bold uppercase tracking-[0.1em] ${match.status === 'live' ? 'text-[#E30613]' : isDark ? 'text-neutral-500' : 'text-[#999]'}`}>
          {match.status === 'live' ? 'En vivo' : match.status === 'finished' ? 'Final' : 'Próximo'} · {match.homeScore}-{match.awayScore}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 p-4">
        {coverage.posts.map((post) => (
          <PostCard key={post.id} post={post} isDark={isDark} onOpen={onOpen} variant="compact" />
        ))}
      </div>
    </div>
  )
}
