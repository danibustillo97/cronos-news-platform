"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface News {
  id: string;
  title: string;
  content: string;
  image_url: string;
  published_at: string;
  category?: string;
  author?: string;
  league?: string;
  country?: string;
  team?: string;
  tags?: string[];
  slug: string;
}

export default function AdminPage() {
  const [newsList, setNewsList] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/news/drafts")
      .then((res) => res.json())
      .then(data => {
        setNewsList(Array.isArray(data.news) ? data.news : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Función para guardar la noticia seleccionada en localStorage antes de navegar
  const handleEdit = (news: News) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("draft_news_edit", JSON.stringify(news));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-yellow-400 tracking-tight">Noticias en Borrador</h1>
        <Link href="/admin/editor/new">
          <button className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-2 rounded-lg shadow-md transition">
            + Nueva Noticia
          </button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Cargando noticias...</div>
      ) : newsList.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No hay noticias en borrador.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-neutral-950/90 shadow-xl border border-neutral-800">
          <table className="min-w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-neutral-950 border-b border-yellow-400">
              <tr>
                <th className="py-3 px-4 text-yellow-400 font-semibold">Título</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Autor</th>
                <th className="py-3 px-4">Liga</th>
                <th className="py-3 px-4">País</th>
                <th className="py-3 px-4">Equipo</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {newsList.map((n) => (
                <tr
                  key={n.id}
                  className="border-b border-neutral-800 hover:bg-neutral-900/80 transition group"
                >
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                    {n.image_url &&
                      <img src={n.image_url} alt="" className="w-9 h-9 rounded object-cover border border-neutral-800" />
                    }
                    <span>{n.title}</span>
                  </td>
                  <td className="py-3 px-4 text-neutral-200">{n.category || "-"}</td>
                  <td className="py-3 px-4 text-neutral-300">{n.author || "-"}</td>
                  <td className="py-3 px-4 text-neutral-300">{n.league || "-"}</td>
                  <td className="py-3 px-4 text-neutral-300">{n.country || "-"}</td>
                  <td className="py-3 px-4 text-neutral-300">{n.team || "-"}</td>
                  <td className="py-3 px-4 text-neutral-200">
                    {n.tags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {n.tags.map(tag => (
                          <span key={tag} className="bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded text-xs font-semibold">{tag}</span>
                        ))}
                      </div>
                    ) : "-"}
                  </td>
                  <td className="py-3 px-4 text-neutral-400">
                    {n.published_at ? new Date(n.published_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/admin/editor/${n.id}`} legacyBehavior>
                      <a onClick={() => handleEdit(n)}>
                        <button className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-4 py-1 rounded-lg shadow transition">
                          Editar
                        </button>
                      </a>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
