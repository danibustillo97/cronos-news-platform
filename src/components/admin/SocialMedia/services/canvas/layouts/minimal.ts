import { drawImageCover } from '../primitives';
import { drawLogo } from '../logo';
import { wrapText } from '../text';

export const renderMinimalLayout = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    customTitle: string,
    fontSize: number
) => {
    drawImageCover(ctx, img, 0, 0, w, h);

    const gradient = ctx.createLinearGradient(0, h * 0.7, 0, h);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    drawLogo(ctx, w / 2 - 85, 50, 0.8);

    ctx.textAlign = 'center';
    ctx.font = `bold ${fontSize - 10}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 15;

    wrapText(ctx, customTitle, w / 2, h - 180, w - 180, fontSize * 1.2);

    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
};
