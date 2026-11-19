import type { NewsItem } from '@/studio/shared/types';
import { drawImageCover } from '../primitives';
import { drawLogo } from '../logo';
import { wrapText, getLines } from '../text';

export const renderSplitLayout = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    format: string,
    selectedNews: NewsItem,
    customTitle: string,
    fontSize: number
) => {
    const splitH = format === 'story' ? h * 0.65 : h * 0.55;

    drawImageCover(ctx, img, 0, 0, w, splitH);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, splitH, w, h - splitH);

    ctx.fillStyle = '#DC2626';
    ctx.fillRect(0, splitH, w, 8);

    const headerStart = splitH + 35;
    drawLogo(ctx, 50, headerStart, 0.7, true);

    const catText = selectedNews?.category?.toUpperCase() || 'NOTICIAS';
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#DC2626';
    ctx.fillText(
        `${catText} • ${new Date().toLocaleDateString()}`,
        50,
        headerStart + 80
    );

    const titleY = headerStart + 130;
    const maxTitleHeight = h - titleY - 40;

    let currentFontSize = fontSize;
    let lines = getLines(ctx, customTitle, w - 100);
    const ratio = 1.1;

    while ((lines.length * currentFontSize * ratio) > maxTitleHeight && currentFontSize > 24) {
        currentFontSize -= 2;
        ctx.font = `900 ${currentFontSize}px Arial`;
        lines = getLines(ctx, customTitle, w - 100);
    }

    wrapText(ctx, customTitle, 50, titleY, w - 100, currentFontSize * ratio);
};
