'use client';

// Direct link / share / reload path for reading an article -- the exact
// same real reading experience as the floating window opened from the
// portal (see ArticleContent.tsx, shared by both). There is no second,
// differently-designed page anymore: whichever path a reader lands on,
// this is what they see.

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ArticleContent from "@/components/news/ArticleContent";
import type { NewsView } from "@/types/news";

export default function ArticleClient({ news }: { news: NewsView }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-neutral-200/60 dark:bg-neutral-900 py-0 md:py-10">
      <div className="max-w-5xl mx-auto md:rounded-[28px] bg-white text-neutral-900 shadow-[0_35px_100px_rgba(15,23,42,0.25)] overflow-hidden border border-neutral-200 relative">
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
          className="absolute top-4 left-4 z-20 bg-neutral-900/80 hover:bg-neutral-950 text-white p-2.5 rounded-full backdrop-blur-md transition-all duration-200 shadow-lg"
          aria-label="Volver"
        >
          <ArrowLeft size={22} />
        </button>

        <ArticleContent
          news={news}
          onRelatedClick={(related) => router.push(`/noticia/${related.slug}`)}
        />
      </div>
    </div>
  );
}
