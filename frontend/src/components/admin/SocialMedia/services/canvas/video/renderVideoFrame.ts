import type { NewsItem, ScriptSegment } from '@/studio/shared/types';
import { drawLogo } from '../logo';
import { drawImageCover } from '../primitives';
import { getLines } from '../text';
import { drawSponsor } from '../sponsor';
import { renderIntro } from './intro';
import { renderOutro } from './outro';

export const renderVideoFrame = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    timeMs: number,
    totalDuration: number,
    sponsorImg: HTMLImageElement | null,
    videoScript: ScriptSegment[],
    selectedNews: NewsItem,
    customTitle: string,
    layoutMode: string,
    fontSize: number,
    format: string,
    showWatermark: boolean,
    sponsorName: string
) => {
    const zoomLevel = 1 + (timeMs / totalDuration) * 0.15;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const ratio = Math.max(w / img.width, h / img.height);
    const scaledW = img.width * ratio * zoomLevel;
    const scaledH = img.height * ratio * zoomLevel;
    const x = (w - scaledW) / 2;
    const y = (h - scaledH) / 2;

    ctx.drawImage(img, x, y, scaledW, scaledH);
    ctx.restore();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
    gradient.addColorStop(0.25, 'rgba(0,0,0,0.4)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    let currentText = '';
    let accumulatedTime = 0;
    let isIntro = false;
    let isOutro = false;
    let segmentStartTime = 0;

    for (const segment of videoScript) {
        if (timeMs >= accumulatedTime && timeMs < accumulatedTime + segment.duration) {
            currentText = segment.text;
            isIntro = segment.text === 'INTRO_SEQUENCE';
            isOutro = segment.text === 'OUTRO_SEQUENCE';
            segmentStartTime = accumulatedTime;
            break;
        }
        accumulatedTime += segment.duration;
    }

    if (isIntro) {
        renderIntro(
            ctx,
            img,
            w,
            h,
            timeMs - segmentStartTime,
            fontSize,
            customTitle,
            sponsorImg,
            sponsorName
        );
        return;
    }

    if (isOutro) {
        renderOutro(
            ctx,
            w,
            h,
            timeMs - segmentStartTime,
            sponsorName
        );
        return;
    }

    if (currentText) {
        ctx.save();

        const fade = Math.min((timeMs - segmentStartTime) / 600, 1);
        ctx.globalAlpha = fade;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const isHeadline = currentText === selectedNews.title.toUpperCase();
        const effectiveFontSize = isHeadline ? 60 : 42;

        ctx.font = `900 ${effectiveFontSize}px Arial`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 15;

        const maxWidth = w - 120;
        const lineHeight = effectiveFontSize * 1.3;
        const lines = getLines(ctx, currentText, maxWidth);

        const blockHeight = lines.length * lineHeight;
        const startY = h - 250 - blockHeight;

        lines.forEach((line, i) => {
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 4;
            ctx.strokeText(line.trim(), w / 2, startY + i * lineHeight);
            ctx.fillText(line.trim(), w / 2, startY + i * lineHeight);
        });

        ctx.restore();
    }

    const progressWidth = (timeMs / totalDuration) * w;
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(0, h - 15, progressWidth, 15);

    drawLogo(ctx, 40, 60, 0.7);

    if (sponsorName || sponsorImg) {
        drawSponsor(
            ctx,
            w,
            h,
            layoutMode,
            sponsorImg,
            sponsorName,
            format
        );
    }
};