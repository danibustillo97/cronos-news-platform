'use client';

import { useEffect, useState } from 'react';
import { getDrafts, publishNews } from '@/app/admin/lib/api';
import { Loader2, ExternalLink, Upload, Pencil } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import clsx from 'clsx';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';

type News = {
  id: string;
  title: string;
  content?: string;
  image_url: string | null;
  source_url: string;
  author: string;
  created_at?: string;
};

export default function NewsTable() {
  const [drafts, setDrafts] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [editingNews, setEditingNews] = useState<News | null>(null);

  const loadDrafts = async () => {
    setLoading(true);
    const data = await getDrafts();
    setDrafts(data);
    setLoading(false);
  };

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    await publishNews(id);
    await loadDrafts();
    setPublishingId(null);
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50 text-sm font-semibold text-gray-600">
            <tr>
              <th className="p-4">Imagen</th>
              <th className="p-4">Título</th>
              <th className="p-4">Autor</th>
              <th className="p-4">Fuente</th>
              <th className="p-4">Fecha</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700">
            {drafts.map((news) => (
              <tr key={news.id} className="border-t hover:bg-gray-50 transition">
                <td className="p-4">
                  {news.image_url ? (
                    <img
                      src={news.image_url}
                      alt={news.title}
                      className="w-20 h-12 object-cover rounded-md border"
                    />
                  ) : (
                    <span className="text-gray-400 italic">Sin imagen</span>
                  )}
                </td>
                <td className="p-4 max-w-xs">
                  <div className="font-medium line-clamp-2">{news.title}</div>
                </td>
                <td className="p-4">{news.author || 'Desconocido'}</td>
                <td className="p-4">
                  <a
                    href={news.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Ver <ExternalLink className="w-4 h-4" />
                  </a>
                </td>
                <td className="p-4 text-gray-500">
                  {news.created_at
                    ? new Date(news.created_at).toLocaleString()
                    : '--'}
                </td>
                <td className="p-4 flex gap-2 justify-center">
                  <button
                    onClick={() => setEditingNews(news)}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 transition"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Editar
                  </button>
                  <button
                    onClick={() => handlePublish(news.id)}
                    disabled={publishingId === news.id}
                    className={clsx(
                      'inline-flex items-center px-3 py-1.5 rounded-md text-sm text-white bg-green-600 hover:bg-green-700 transition',
                      publishingId === news.id && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    {publishingId === news.id ? (
                      <>
                        <Loader2 className="animate-spin mr-2 w-4 h-4" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 w-4 h-4" />
                        Publicar
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor lateral */}
      <Dialog open={!!editingNews} onClose={() => setEditingNews(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex justify-end">
          <Dialog.Panel className="w-full max-w-2xl h-full bg-white p-6 overflow-y-auto shadow-xl">
            {editingNews && (
              <>
                <Dialog.Title className="text-xl font-semibold mb-4">Editar noticia</Dialog.Title>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Título</span>
                    <input
                      type="text"
                      value={editingNews.title}
                      onChange={(e) =>
                        setEditingNews({ ...editingNews, title: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Contenido</span>
                    <RichEditor
                      content={editingNews.content || ''}
                      onChange={(html) =>
                        setEditingNews({ ...editingNews, content: html })
                      }
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Autor</span>
                    <input
                      type="text"
                      value={editingNews.author}
                      onChange={(e) =>
                        setEditingNews({ ...editingNews, author: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100"
                    onClick={() => setEditingNews(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                      console.log('Guardar cambios:', editingNews);
                      setEditingNews(null);
                    }}
                  >
                    Guardar cambios
                  </button>
                </div>
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}

// 💡 Editor Rich embebido aquí mismo
function RichEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          'min-h-[300px] w-full p-4 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 prose prose-sm max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-xl shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={getBtn(editor.isActive('bold'))}
        >
          B
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={getBtn(editor.isActive('italic'))}
        >
          I
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={getBtn(editor.isActive('underline'))}
        >
          U
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={getBtn(editor.isActive('bulletList'))}
        >
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={getBtn(editor.isActive('orderedList'))}
        >
          1. List
        </button>
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .setLink({ href: prompt('URL:') || '' })
              .run()
          }
          className={getBtn(editor.isActive('link'))}
        >
          🔗
        </button>
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .setImage({ src: prompt('Image URL') || '' })
              .run()
          }
          className={getBtn(false)}
        >
          🖼️
        </button>
        <button
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="px-2 py-1 text-xs text-red-600 bg-white border border-gray-300 rounded hover:bg-red-50"
        >
          Limpiar
        </button>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}

function getBtn(active: boolean) {
  return `px-2 py-1 text-xs border rounded ${
    active
      ? 'bg-blue-500 text-white border-blue-500'
      : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
  }`;
}
