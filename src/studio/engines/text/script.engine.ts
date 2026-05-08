import type { NewsItem, ScriptSegment } from '@/studio/shared/types';

const sanitizeText = (text: string): string => text.trim().replace(/\s+/g, ' ');

const buildSegments = (title: string, baseImage?: string): ScriptSegment[] => {
  const cleaned = sanitizeText(title || 'Narración generada.');
  const segments: ScriptSegment[] = [
    { text: 'INTRO_SEQUENCE', duration: 1500, image: baseImage ?? null },
    { text: cleaned, duration: Math.max(3000, Math.min(8000, cleaned.length * 70)), image: baseImage ?? null },
    { text: 'OUTRO_SEQUENCE', duration: 1500, image: baseImage ?? null },
  ];

  return segments;
};

export const createScriptEngine = () => {
  return {
    generateFromNews(title: string, selectedNews: NewsItem | null): ScriptSegment[] {
      const baseImage = selectedNews?.image_url;
      return buildSegments(title, baseImage);
    },

    normalizeScript(segments: ScriptSegment[]): ScriptSegment[] {
      return segments.map(segment => ({
        ...segment,
        text: sanitizeText(segment.text),
      }));
    },
  };
};
