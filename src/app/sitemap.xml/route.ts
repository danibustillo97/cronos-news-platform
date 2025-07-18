import { createClient } from "@supabase/supabase-js";
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: news } = await supabase
    .from("news")
    .select("slug, published_at")
    .eq("status", "published");

  const urls = news?.map(
    (item) => `<url>
      <loc>https://tusitio.com/noticia/${item.slug}</loc>
      <lastmod>${item.published_at}</lastmod>
    </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls?.join("")}
    </urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
