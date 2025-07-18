// lib/api.ts

export const getDrafts = async () => {
  const res = await fetch('https://backendcronosnews-production.up.railway.app/api/news/drafts');
  if (!res.ok) {
    console.error('Error al obtener noticias:', res.statusText);
    return [];
  }

  const data = await res.json();
  return data.news || [];
};

export const publishNews = async (id: string) => {
  const res = await fetch(`https://backendcronosnews-production.up.railway.app/api/news/${id}/publish`, {
    method: 'PUT',
  });

  if (!res.ok) {
    console.error('Error al publicar noticia:', res.statusText);
  }
};
