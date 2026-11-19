"use client";

// "Vista previa" -- ÚLTIMO BLOQUE ANTES DE PUBLISH section 6: this must
// render EXACTLY the same document Artifact/the editor produced, never a
// second, hand-reconstructed version. It does this by mounting the SAME
// Tiptap document (StarterKit + EditorialImageNode) read-only, so a body
// image renders through the exact same node (EditorialImageView, in its
// read-only branch) the editor itself uses -- not a parallel regex-based
// HTML rewrite. content_html here is always the same restricted,
// validated tag set validate_artifact enforces (see backend/app/domain/
// artifact/validation.py's _ALLOWED_HTML_TAGS).

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import { X } from "lucide-react";
import { stripArticleWrapper } from "./RevisionEditor";
import EditorialImageNode from "./EditorialImageNode";
import { EditorialImageContext } from "./EditorialImageContext";
import type { MediaRequirement } from "./MediaRequirementBlock";
import { EditorialImageGallery, EditorialVideo } from "@/components/news/EditorialBlockNodes";

export default function ArticlePreviewModal({
  title, subtitle, excerpt, contentHtml, featuredImageUrl, mediaRequirements, artifactId, onClose,
}: {
  title: string;
  subtitle: string;
  excerpt: string;
  contentHtml: string;
  featuredImageUrl: string | null;
  mediaRequirements: MediaRequirement[];
  artifactId: string;
  onClose: () => void;
}) {
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit, Image.configure({ inline: false }), Underline, Link,
      TableKit.configure({ table: { resizable: true } }), Youtube.configure({ nocookie: true }),
      EditorialImageGallery, EditorialVideo, EditorialImageNode,
    ],
    content: stripArticleWrapper(contentHtml),
    immediatelyRender: false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h3 className="text-sm font-bold text-white">Vista previa</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {featuredImageUrl && <img src={featuredImageUrl} alt="" className="w-full rounded-xl mb-5 object-cover max-h-80" />}
          <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2">{excerpt}</p>
          <h1 className="text-2xl font-bold text-white mb-1.5">{title}</h1>
          {subtitle && <p className="text-neutral-400 mb-5">{subtitle}</p>}
          <EditorialImageContext.Provider value={{ artifactId, mediaRequirements, onMediaChanged: () => {} }}>
            <div className="prose prose-invert max-w-none prose-p:text-neutral-300 prose-headings:text-white prose-a:text-blue-400 prose-img:rounded-xl prose-figcaption:text-neutral-500 prose-figcaption:text-[12px]">
              <EditorContent editor={editor} />
            </div>
          </EditorialImageContext.Provider>
        </div>
      </div>
    </div>
  );
}
