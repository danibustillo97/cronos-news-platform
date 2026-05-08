import type { NewsItem, ScriptSegment, VideoTimeline, VideoScene } from '@/studio/shared/types';

const INTRO_DURATION = 3000;
const OUTRO_DURATION = 3000;

/**
 * Construye un VideoTimeline declarativo a partir
 * del script y la noticia.
 */
export const buildVideoTimeline = (
    news: NewsItem,
    script: ScriptSegment[]
): VideoTimeline => {
    let cursor = 0;
    const scenes: VideoScene[] = [];

    // Intro
    scenes.push({
        id: 'intro',
        type: 'intro',
        startMs: cursor,
        durationMs: INTRO_DURATION,
        payload: {},
    });

    cursor += INTRO_DURATION;

    // Headline
    scenes.push({
        id: 'headline',
        type: 'headline',
        startMs: cursor,
        durationMs: 3000,
        payload: {
            text: news.title,
        },
    });

    cursor += 3000;

    // Script segments
    script.forEach((segment, index) => {
        scenes.push({
            id: `segment-${index}`,
            type: 'paragraph',
            startMs: cursor,
            durationMs: segment.duration,
            payload: {
                text: segment.text,
                imageUrl: segment.image ?? undefined,
            },
        });

        cursor += segment.duration;
    });

    // Outro
    scenes.push({
        id: 'outro',
        type: 'outro',
        startMs: cursor,
        durationMs: OUTRO_DURATION,
        payload: {},
    });

    cursor += OUTRO_DURATION;

    return {
        durationMs: cursor,
        scenes,
        sourceNews: news,
    };
};