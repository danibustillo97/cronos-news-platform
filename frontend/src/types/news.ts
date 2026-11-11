export interface News {
  id: string;
  title: string;
  content?: string;
  excerpt?: string;
  image_url: string;
  images?: string[]; // For galleries
  category?: string;
  subcategory?: string;
  tags?: string[];
  
  // Metadata & SEO
  slug: string;
  seo_title?: string;
  seo_description?: string;
  
  // Status & Publishing
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_at: string;
  updated_at: string;
  
  // Author Info (Denormalized for speed or relation id)
  author_id?: string;
  author_name?: string;
  author_avatar?: string;
  
  // Engagement / Metrics
  views: number;
  likes: number;
  comments_count: number;
  shares: number;
  
  // Flags
  featured: boolean;
  trending: boolean;
  breaking: boolean;
}

export interface NewsDraft extends Partial<News> {
  id: string; // Drafts always have an ID (client-generated if new)
  localChanges?: boolean; // UI state
}

export interface NewsView {
  id: string;
  title: string;
  subtitle?: string;
  content?: string;
  excerpt?: string;
  image_url: string;
  published_at: string;
  category?: string;
  author?: string;
  tags?: string[];
  slug: string;
  // Editorial FORMAT (analysis/explainer/perspective), distinct from
  // category (topic). Nullable -- see infrastructure/database/supabase_setup/add_content_format.sql.
  // Powers "En Contexto"; absent until that migration runs and something
  // populates it.
  content_format?: string | null;
}
