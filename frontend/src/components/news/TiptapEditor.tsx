"use client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import type { JSONContent } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Image as ImageIcon, Quote,
  Link as LinkIcon, Code, Maximize2, Minimize2, ImagePlus, Images, Table2, Video, Film,
  Undo2, Redo2, Plus, Minus, X,
} from "lucide-react";
import Select, { type SelectOption } from "@/components/ui/Select";
import { apiUrl } from "@/studio/lab/api-client";
import EditorialImageNode from "@/components/admin/Editorial/EditorialImageNode";
import { EditorialImageContext } from "@/components/admin/Editorial/EditorialImageContext";
import type { MediaRequirement } from "@/components/admin/Editorial/MediaRequirementBlock";
import { EditorialImageGallery, EditorialVideo } from "./EditorialBlockNodes";

interface Props {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  // Only present in the editorial Revisión workflow -- when set, body images
  // become real inline document blocks (see EditorialImageNode).
  artifactId?: string;
  mediaRequirements?: MediaRequirement[];
  onMediaChanged?: () => void;
}

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "blockquote";
type InsertDialogKind = "link" | "image" | "gallery" | "video" | "youtube";

const SportsStatisticsTable: JSONContent = {
  type: "table",
  content: [
    ["Estadística", "Local", "Visitante"],
    ["Goles", "", ""],
    ["Posesión", "", ""],
    ["Tiros al arco", "", ""],
  ].map((row, rowIndex) => ({
    type: "tableRow",
    content: row.map((text) => ({
      type: rowIndex === 0 ? "tableHeader" : "tableCell",
      content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
    })),
  })),
};

function secureHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

const BLOCK_OPTIONS: SelectOption<BlockType>[] = [
  { value: "paragraph", label: "Párrafo" },
  { value: "h1", label: "Título 1" },
  { value: "h2", label: "Título 2" },
  { value: "h3", label: "Título 3" },
  { value: "blockquote", label: "Cita" },
];

function currentBlockType(editor: Editor): BlockType {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("blockquote")) return "blockquote";
  return "paragraph";
}

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`p-2 rounded transition-colors ${active ? "text-white bg-white/10" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"}`}
    >
      {children}
    </button>
  );
}

const MenuBar = ({
  editor, isFullscreen, onToggleFullscreen, onInsertBodyImage, insertingImage, onOpenDialog,
}: {
  editor: Editor | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onInsertBodyImage?: () => void;
  insertingImage?: boolean;
  onOpenDialog: (kind: InsertDialogKind, value?: string) => void;
}) => {
  if (!editor) {
    return null;
  }

  const setBlockType = (type: BlockType) => {
    const chain = editor.chain().focus();
    if (type === "paragraph") chain.setParagraph().run();
    else if (type === "h1") chain.toggleHeading({ level: 1 }).run();
    else if (type === "h2") chain.toggleHeading({ level: 2 }).run();
    else if (type === "h3") chain.toggleHeading({ level: 3 }).run();
    else chain.toggleBlockquote().run();
  };

  return (
    <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-1 border-b border-white/10 bg-[#0d0d0d]/95 p-2 backdrop-blur-md">
      <Select
        value={currentBlockType(editor)}
        onChange={setBlockType}
        options={BLOCK_OPTIONS}
        className="w-[124px]"
        buttonClassName="!py-1 !text-[12px]"
      />
      <div className="mx-1 h-6 w-px self-center bg-white/10" />
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Deshacer (Ctrl/⌘+Z)">
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Rehacer (Ctrl/⌘+Shift+Z)">
        <Redo2 size={16} />
      </ToolbarButton>
      <div className="mx-1 h-6 w-px self-center bg-white/10" />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrita (Cmd+B)">
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Cursiva (Cmd+I)">
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Subrayado (Cmd+U)">
        <UnderlineIcon size={16} />
      </ToolbarButton>
      <div className="w-[1px] bg-white/5 h-6 mx-1 self-center" />
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista">
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Cita">
        <Quote size={16} />
      </ToolbarButton>
      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded px-2.5 py-2 text-xs font-medium text-neutral-300 hover:bg-white/10">
          <Plus size={14} /> Insertar bloque
        </summary>
        <div className="absolute left-0 top-full z-30 mt-2 grid w-64 gap-1 rounded-xl border border-white/10 bg-neutral-950 p-2 shadow-2xl sm:grid-cols-2">
          <button type="button" onClick={() => onOpenDialog("link", String(editor.getAttributes("link").href ?? ""))} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <LinkIcon size={14} /> Enlace
          </button>
          <button type="button" onClick={() => onOpenDialog("image")} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <ImageIcon size={14} /> Imagen por URL
          </button>
          {onInsertBodyImage && (
            <button type="button" onClick={onInsertBodyImage} disabled={insertingImage} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10 disabled:opacity-50">
              <ImagePlus size={14} /> {insertingImage ? "Preparando imagen…" : "Imagen del cuerpo"}
            </button>
          )}
          <button type="button" onClick={() => onOpenDialog("gallery")} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <Images size={14} /> Galería
          </button>
          <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <Table2 size={14} /> Tabla
          </button>
          <button type="button" onClick={() => editor.chain().focus().insertContent(SportsStatisticsTable).run()} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <span className="w-[14px] text-center text-[10px] font-bold">ST</span> Estadísticas
          </button>
          <button type="button" onClick={() => onOpenDialog("video")} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <Video size={14} /> Video
          </button>
          <button type="button" onClick={() => onOpenDialog("youtube")} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <Film size={14} /> YouTube
          </button>
          <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <Minus size={14} /> Separador
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-neutral-300 hover:bg-white/10">
            <Code size={14} /> Código
          </button>
        </div>
      </details>
      {editor.isActive("table") && (
        <div className="flex items-center gap-0.5 border-l border-white/10 pl-1">
          <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Añadir fila">
            <Plus size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Añadir columna">
            <Table2 size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Eliminar tabla">
            <X size={14} />
          </ToolbarButton>
        </div>
      )}
      <div className="ml-auto">
        <ToolbarButton onClick={onToggleFullscreen} title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </ToolbarButton>
      </div>
    </div>
  );
};

export default function TiptapEditor({
  value, onChange, className, artifactId, mediaRequirements, onMediaChanged,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [insertingImage, setInsertingImage] = useState(false);
  const [dialogKind, setDialogKind] = useState<InsertDialogKind | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [documentStats, setDocumentStats] = useState({ words: 0, characters: 0 });

  const openDialog = (kind: InsertDialogKind, initialValue = "") => {
    setDialogValue(initialValue);
    setDialogKind(kind);
  };

  const extensions = useMemo(() => {
    const base = [
      StarterKit,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TableKit.configure({ table: { resizable: true } }),
      Youtube.configure({ nocookie: true }),
      EditorialImageGallery,
      EditorialVideo,
    ];
    return artifactId ? [...base, EditorialImageNode] : base;
    // artifactId presence never changes for a mounted editor instance, so the
    // extension list is stable for the lifetime of this editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(artifactId)]);

  const editor = useEditor({
    extensions,
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      const text = editor.getText().trim();
      setDocumentStats({
        words: text ? text.split(/\s+/).length : 0,
        characters: text.length,
      });
    },
    editorProps: {
      attributes: {
        class:
          "h-full overflow-y-auto outline-none prose prose-invert max-w-none prose-lg prose-p:text-neutral-300 prose-headings:font-bold prose-headings:text-white prose-a:text-blue-400 prose-strong:text-white prose-blockquote:border-l-2 prose-blockquote:border-white/20 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-400 prose-img:rounded-xl prose-code:text-amber-300",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    // Only update content if it's significantly different to prevent cursor jumps
    if (editor && value !== editor.getHTML()) {
       // Check if the change is just empty paragraph differences or real content
       if (editor.getHTML() === '<p></p>' && !value) return;

       // Only set content if it's actually different to avoid cursor reset
       editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    const text = editor.getText().trim();
    setDocumentStats({
      words: text ? text.split(/\s+/).length : 0,
      characters: text.length,
    });
  }, [editor]);

  const submitInsertDialog = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || !dialogKind) return;

    if (dialogKind === "link") {
      if (!dialogValue.trim()) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        setDialogKind(null);
        return;
      }
      const url = secureHttpsUrl(dialogValue);
      if (!url) {
        toast.error("Introduce un enlace HTTPS válido");
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else if (dialogKind === "image") {
      const url = secureHttpsUrl(dialogValue);
      if (!url) {
        toast.error("Introduce una URL HTTPS válida para la imagen");
        return;
      }
      editor.chain().focus().setImage({ src: url }).run();
    } else if (dialogKind === "gallery") {
      const values = dialogValue.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
      const urls = values.map(secureHttpsUrl).filter((url): url is string => url !== null);
      if (!values.length || urls.length !== values.length) {
        toast.error("Usa una URL HTTPS válida para cada imagen");
        return;
      }
      editor.chain().focus().insertContent({
        type: "editorialImageGallery",
        content: urls.map((src) => ({ type: "image", attrs: { src, alt: "" } })),
      }).run();
    } else if (dialogKind === "video") {
      const url = secureHttpsUrl(dialogValue);
      if (!url) {
        toast.error("El video debe usar una URL HTTPS válida");
        return;
      }
      editor.chain().focus().insertContent({ type: "editorialVideo", attrs: { src: url } }).run();
    } else {
      const url = secureHttpsUrl(dialogValue);
      if (!url || !isYouTubeUrl(url)) {
        toast.error("Introduce una URL HTTPS válida de YouTube");
        return;
      }
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }

    setDialogKind(null);
  };

  const insertBodyImage = async () => {
    if (!editor || !artifactId || !onMediaChanged) return;
    setInsertingImage(true);
    try {
      const res = await fetch(apiUrl(`/api/artifacts/${artifactId}/media`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "BODY_IMAGE" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      const existingIds = new Set((mediaRequirements ?? []).map((media) => media.placeholderId));
      const artifact: { mediaRequirements?: { placeholderId: string; kind: string }[] } = await res.json();
      onMediaChanged();
      const created = artifact.mediaRequirements?.find(
        (media) => media.kind === "BODY_IMAGE" && !existingIds.has(media.placeholderId),
      );
      if (created) {
        editor.chain().focus().insertEditorialImage(created.placeholderId).run();
      } else {
        toast.error("Imagen creada pero no se pudo insertar en el documento");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo insertar la imagen");
    } finally {
      setInsertingImage(false);
    }
  };

  if (!editor) return <div className="animate-pulse text-sm text-neutral-600">Cargando editor…</div>;

  const body = (
    <div className={`flex h-full flex-col ${className ?? ""} ${isFullscreen ? "fixed inset-0 z-50 bg-neutral-950 p-4" : ""}`}>
      <MenuBar
        editor={editor}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((v) => !v)}
        onInsertBodyImage={artifactId ? insertBodyImage : undefined}
        insertingImage={insertingImage}
        onOpenDialog={openDialog}
      />
      <EditorContent editor={editor} className="flex-1 overflow-hidden" />
      <div className="flex flex-shrink-0 items-center justify-between border-t border-white/5 px-2 py-2 text-[10px] text-neutral-600">
        <span>{documentStats.words} palabras</span>
        <span>{documentStats.characters} caracteres</span>
      </div>
      {dialogKind && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialogKind(null);
        }}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-insert-dialog-title"
            onSubmit={submitInsertDialog}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl"
          >
            <h2 id="editor-insert-dialog-title" className="text-base font-semibold text-white">
              {dialogKind === "link" ? "Insertar enlace" :
                dialogKind === "image" ? "Insertar imagen" :
                dialogKind === "gallery" ? "Insertar galería" :
                dialogKind === "video" ? "Insertar video" : "Insertar video de YouTube"}
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {dialogKind === "gallery"
                ? "Añade una URL HTTPS por línea."
                : dialogKind === "link" && dialogValue
                  ? "Edita el enlace seleccionado o déjalo vacío para quitarlo."
                  : "Usa una dirección HTTPS segura."}
            </p>
            {dialogKind === "gallery" ? (
              <textarea
                autoFocus
                rows={5}
                value={dialogValue}
                onChange={(event) => setDialogValue(event.target.value)}
                placeholder={"https://sitio.com/imagen-1.jpg\nhttps://sitio.com/imagen-2.jpg"}
                className="mt-4 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
            ) : (
              <input
                autoFocus
                type="url"
                value={dialogValue}
                onChange={(event) => setDialogValue(event.target.value)}
                placeholder={dialogKind === "youtube" ? "https://www.youtube.com/watch?v=…" : "https://"}
                className="mt-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDialogKind(null)} className="rounded-lg px-3 py-2 text-xs font-medium text-neutral-400 hover:bg-white/5 hover:text-white">
                Cancelar
              </button>
              <button type="submit" className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-200">
                Insertar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  if (!artifactId) return body;

  return (
    <EditorialImageContext.Provider
      value={{ artifactId, mediaRequirements: mediaRequirements ?? [], onMediaChanged: onMediaChanged ?? (() => {}) }}
    >
      {body}
    </EditorialImageContext.Provider>
  );
}
