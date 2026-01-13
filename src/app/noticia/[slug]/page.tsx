import { supabase } from '@/lib/supabaseClient';
import { Metadata } from 'next';
import ArticleClient from './ArticleClient';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const { data } = await supabase
    .from('news')
    .select('title, summary, image_url, slug')
    .eq('slug', params.slug)
    .single();

  if (!data) {
    return {
      title: 'Noticia no encontrada | Nexus News',
    };
  }

  const url = `https://www.nexusnews.info/noticia/${data.slug}`;

  return {
    title: `${data.title} | Nexus News`,
    description: data.summary,
    alternates: { canonical: url },
    openGraph: {
      title: data.title,
      description: data.summary,
      url,
      siteName: 'Nexus News',
      images: [
        {
          url: data.image_url,
          width: 1200,
          height: 630,
          alt: data.title,
        },
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description: data.summary,
      images: [data.image_url],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { data: news } = await supabase
    .from('news')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (!news) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title,
    image: [news.image_url],
    datePublished: news.published_at,
    dateModified: news.published_at,
    author: {
      '@type': 'Person',
      name: news.author || 'Nexus News',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Nexus News',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.nexusnews.info/logo.png',
      },
    },
    description: news.summary,
    mainEntityOfPage: `https://www.nexusnews.info/noticia/${news.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleClient news={news} />
    </>
  );
}
