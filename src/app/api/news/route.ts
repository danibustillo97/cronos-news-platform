// /app/api/news/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://mxvdnfaeqjifnxqmxbri.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dmRuZmFlcWppZm54cW14YnJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjg0NzAsImV4cCI6MjA2Nzg0NDQ3MH0.KLD8IAWiAIhkKXJ9lZR7Yc6GaPpxOa3zdaItozCw4Hc';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  const { data, error } = await supabase
    .from("news")
    .select("id, title, slug, image_url, author, published_at") // quitamos summary
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ news: data }, { status: 200 });
}
