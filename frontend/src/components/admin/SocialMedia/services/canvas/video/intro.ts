import { drawLogo } from '../logo';
import { drawImageCover } from '../primitives';
import { getLines } from '../text';

export const renderIntro = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    localTime: number,
    fontSize: number,
    customTitle: string,
    sponsorImg: HTMLImageElement | null,
    sponsorName: string
) => {
    ctx.save();

    const introZoom = 1 + (localTime / 4000) * 0.1;
    const ratio = Math.max(w / img.width, h / img.height);
    const scaledW = img.width * ratio * introZoom;
    const scaledH = img.height * ratio * introZoom;
    const ix = (w - scaledW) / 2;
    const iy = (h - scaledH) / 2;

    ctx.drawImage(img, ix, iy, scaledW, scaledH);

    const overlayOpacity = Math.max(0.3, 0.7 - (localTime / 4000) * 0.4);
    ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
    ctx.fillRect(0, 0, w, h);

    const easeOutElastic = (t: number) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
            ? 0
            : t === 1
                ? 1
                : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    };

    const centerLogoSize = 1.8;
    const finalLogoScale = 0.7;
    const safeMargin = 40;
    const headerY = 60;

    const centerVisualWidth = 390 * centerLogoSize;
    const centerX = (w - centerVisualWidth) / 2;
    const centerY = h / 2 - 150;

    let currentScale = centerLogoSize;
    let currentX = centerX;
    let currentY = centerY;
    let alpha = 1;

    if (localTime < 2500) {
        alpha = Math.min(localTime / 1500, 1);
    } else {
        const p = Math.min((localTime - 2500) / 1000, 1);
        currentScale = centerLogoSize + (finalLogoScale - centerLogoSize) * p;
        currentX = centerX + (safeMargin - centerX) * p;
        currentY = centerY + (headerY - centerY) * p;
    }

    ctx.globalAlpha = alpha;
    drawLogo(ctx, currentX, currentY, currentScale);
    ctx.globalAlpha = 1;

    if (localTime > 500 && localTime < 2500) {
        ctx.save();
        ctx.translate(w / 2, h / 2 + 50);
        const t = Math.min((localTime - 500) / 1000, 1);
        ctx.scale(t, t);
        ctx.font = `900 ${fontSize * 1.2}px Arial`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#DC2626';
        ctx.shadowBlur = 20;

        getLines(ctx, customTitle, w - 100).forEach((l, i) => {
            ctx.fillText(l.trim(), 0, i * fontSize * 1.3);
        });
        ctx.restore();
    }

    if (sponsorName && localTime > 1500) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('PRESENTADO POR', w / 2, h - 150);

        if (sponsorImg) {
            ctx.drawImage(sponsorImg, w / 2 - 40, h - 130, 80, 80);
            ctx.font = '900 32px Arial';
            ctx.fillStyle = '#DC2626';
            ctx.fillText(sponsorName.toUpperCase(), w / 2, h - 20);
        }
    }

    ctx.restore();
};