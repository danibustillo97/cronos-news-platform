import type { NewsItem } from '@/studio/shared/types';

/**
 * Hook one-liners built from whatever news is actually selected — {title}
 * and {category} always exist on NewsItem, unlike the old hardcoded
 * "Barcelona"/"Messi"/"el Clásico" placeholders this used to have.
 */
const HOOK_TEMPLATES: { emoji: string; text: string }[] = [
  { emoji: '😱', text: 'Esto es LOCURA... {title}' },
  { emoji: '🤫', text: 'El secreto que nadie te cuenta sobre {category}...' },
  { emoji: '❌', text: 'El ERROR más grande: {title}' },
  { emoji: '👀', text: 'La VERDAD sobre {title}...' },
  { emoji: '⚡', text: 'URGENTE: {title}' },
  { emoji: '3️⃣', text: '3 cosas que no sabías de {category}' },
  { emoji: '❓', text: '¿Por qué pasó esto? {title}' },
  { emoji: '🔮', text: 'Esto va a PASAR después de: {title}' },
];

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

export function generateHookText(news: NewsItem | null): string {
  const template = HOOK_TEMPLATES[Math.floor(Math.random() * HOOK_TEMPLATES.length)];
  const title = news?.title ? truncate(news.title, 60) : 'esta noticia';
  const category = news?.category || 'deportes';

  const text = template.text
    .replace('{title}', title)
    .replace('{category}', category.toLowerCase());

  return `${template.emoji} ${text}`;
}
