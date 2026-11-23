// The editable fields of an article in the editor (autosaved via PATCH /api/artifacts/{id}).
export interface RevisionDraft {
  title: string;
  subtitle: string;
  excerpt: string;
  summary: string;
  contentHtml: string;
  categoryId: string | null;
  tags: string[];
}
