import type { NewsItem } from '@/studio/shared/types';
import { drawImageCover, drawRoundRect } from '../primitives';
import { drawLogo } from '../logo';
import { wrapText } from '../text';

export const renderOverlayLayout = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    selectedNews: NewsItem,
    customTitle: string,
    fontSize: number
) => {
    drawImageCover(ctx, img, 0, 0, w, h);

    const gradient = ctx.createLinearGradient(0, h * 0.3, 0, h);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.7)');
    gradient.addColorStop(0.8, 'rgba(0,0,0,0.9)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const topGradient = ctx.createLinearGradient(0, 0, 0, 300);
    topGradient.addColorStop(0, 'rgba(0,0,0,0.8)');
    topGradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, w, 300);

    drawLogo(ctx, 50, 50, 1.0);

    const catText = selectedNews?.category?.toUpperCase() || 'NOTICIAS';
    ctx.font = 'bold 24px Arial';
    const catWidth = ctx.measureText(catText).width;

    const pillY = h - 350;
    ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
    drawRoundRect(ctx, 50, pillY, catWidth + 40, 44, 22);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(catText, 70, pillY + 30);

    const titleY = h - 250;
    ctx.save();
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 4;

    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    wrapText(ctx, customTitle, 50, titleY, w - 100, fontSize * 1.2);
    ctx.restore();
};