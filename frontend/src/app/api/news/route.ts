// /app/api/news/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { filterCurrentNews, newsQueryFloor } from "@/lib/newsFreshness";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("news")
    .select("id, title, slug, image_url, author, published_at") // quitamos summary
    .eq("status", "published")
    .gte("published_at", newsQueryFloor())
    .order("published_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ news: filterCurrentNews(data ?? []) }, { status: 200 });
}
