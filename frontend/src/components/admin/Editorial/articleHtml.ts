// Artifact bodies are stored wrapped in <article>; the editor works on the inner HTML.

export function stripArticleWrapper(html: string): string {
  const match = html.match(/<article[^>]*>([\s\S]*)<\/article>/);
  return match ? match[1] : html;
}

export function wrapArticle(html: string): string {
  return `<article>${html}</article>`;
}
