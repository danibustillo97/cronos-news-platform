'use client';

// Direct link / share / reload path for reading an article -- the exact
// same real reading experience as the floating window opened from the
// portal (see ArticleContent.tsx, shared by both). There is no second,
// differently-designed page anymore: whichever path a reader lands on,
// this is what they see -- a real page with the real site navbar, not a
// floating card over a backdrop.

import { useRouter } from "next/navigation";
import ModernNavbar from "@/components/ui/ModernNavbar";
import ArticleContent from "@/components/news/ArticleContent";
import type { NewsView } from "@/types/news";

export default function ArticleClient({ news }: { news: NewsView }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <ModernNavbar />
      <div className="pt-16">
        <ArticleContent
          news={news}
          onRelatedClick={(related) => router.push(`/noticia/${related.slug}`)}
        />
      </div>
    </div>
  );
}
