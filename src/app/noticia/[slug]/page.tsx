import { supabase } from '@/lib/supabaseClient';
import { Metadata } from 'next';
import ArticleClient from './ArticleClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from('news')
    .select('title, summary, excerpt, image_url, slug, category, author, published_at, tags')
    .eq('slug', slug)
    .single();

  if (!data) {
    return { title: 'Noticia no encontrada | Nexus News' };
  }

  const url = `https://www.nexusnews.info/noticia/${data.slug}`;
  const description = data.summary || data.excerpt || data.title;

  return {
    title: data.title,
    description,
    alternates: { canonical: url },
    keywords: data.tags && data.tags.length > 0 ? data.tags : undefined,
    authors: data.author ? [{ name: data.author }] : undefined,
    openGraph: {
      type: 'article',
      title: data.title,
      description,
      url,
      siteName: 'Nexus News',
      publishedTime: data.published_at,
      authors: data.author ? [data.author] : undefined,
      section: data.category || undefined,
      tags: data.tags || undefined,
      images: data.image_url ? [{ url: data.image_url, width: 1200, height: 630, alt: data.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description,
      images: data.image_url ? [data.image_url] : undefined,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const { data: news } = await supabase
    .from('news')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!news) return null;

  // dateModified: solo se usa updated_at si REALMENTE existe y es distinto
  // de published_at -- nunca se "refresca" una fecha artificialmente
  // (sección 12 del pedido).
  const dateModified = news.updated_at && news.updated_at !== news.published_at ? news.updated_at : news.published_at;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title,
    description: news.summary || news.excerpt || undefined,
    image: news.image_url ? [news.image_url] : undefined,
    datePublished: news.published_at,
    dateModified,
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
    articleSection: news.category || undefined,
    keywords: news.tags && news.tags.length > 0 ? news.tags.join(', ') : undefined,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://www.nexusnews.info/noticia/${news.slug}`,
    },
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
