import type { VideoTimeline, VideoScene } from '@/studio/shared/types';
import { renderIntro } from './intro';
import { renderOutro } from './outro';
import { getLines } from '../text';

const renderTextScene = (
    ctx: CanvasRenderingContext2D,
    scene: VideoScene,
    width: number,
    height: number
) => {
    if (!scene.payload.text) return;

    ctx.save();

    const isHeadline = scene.type === 'headline';
    const fontSize = isHeadline ? 60 : 42;

    ctx.font = `900 ${fontSize}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = width - 120;
    const lineHeight = fontSize * 1.3;
    const lines = getLines(ctx, scene.payload.text, maxWidth);

    const blockHeight = lines.length * lineHeight;
    const startY = height - 250 - blockHeight;

    lines.forEach((line, i) => {
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 4;
        ctx.strokeText(line.trim(), width / 2, startY + i * lineHeight);
        ctx.fillText(line.trim(), width / 2, startY + i * lineHeight);
    });

    ctx.restore();
};

export const renderVideoTimeline = (
    ctx: CanvasRenderingContext2D,
    timeline: VideoTimeline,
    currentTimeMs: number,
    width: number,
    height: number,
    img: HTMLImageElement,
    fontSize: number,
    sponsorImg: HTMLImageElement | null,
    sponsorName: string
): void => {
    const scene = timeline.scenes.find(
        (s: VideoScene) =>
            currentTimeMs >= s.startMs &&
            currentTimeMs < s.startMs + s.durationMs
    );

    if (!scene) return;

    const localTime = currentTimeMs - scene.startMs;

    if (scene.type === 'intro') {
        renderIntro(
            ctx,
            img,
            width,
            height,
            localTime,
            fontSize,
            timeline.sourceNews.title,
            sponsorImg,
            sponsorName
        );
        return;
    }

    if (scene.type === 'outro') {
        renderOutro(
            ctx,
            width,
            height,
            localTime,
            sponsorName
        );
        return;
    }

    renderTextScene(ctx, scene, width, height);
};