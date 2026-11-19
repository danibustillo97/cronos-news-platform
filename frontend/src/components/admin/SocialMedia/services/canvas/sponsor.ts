import { drawRoundRect, drawImageCover } from './primitives';

export const drawSponsor = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    layout: string,
    logo: HTMLImageElement | null,
    sponsorName: string,
    format: string
) => {
    ctx.save();

    const isSplit = layout === 'split';
    let x: number, y: number;

    if (isSplit) {
        const splitH = format === 'story' ? h * 0.65 : h * 0.55;
        x = w - 40;
        y = splitH + 60;
    } else {
        x = w - 40;
        y = 60;
    }

    const bgColor = isSplit
        ? '#F3F4F6'
        : 'rgba(255, 255, 255, 0.95)';

    const textColor = '#111827';
    const shadowColor = 'rgba(0,0,0,0.2)';

    const logoSize = 50;
    const padding = 12;
    const gap = 12;

    ctx.font = 'bold 18px Arial';
    const nameWidth = sponsorName
        ? ctx.measureText(sponsorName.toUpperCase()).width
        : 0;

    ctx.font = 'bold 10px Arial';
    const labelText = 'PUBLICIDAD';
    const labelWidth = ctx.measureText(labelText).width;

    let totalWidth = padding * 2;
    if (logo) totalWidth += logoSize + gap;
    totalWidth += Math.max(nameWidth, labelWidth);

    const badgeX = x - totalWidth;
    const badgeH = logoSize + padding * 2;
    const badgeY = y - logoSize / 2 - padding;

    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = bgColor;
    drawRoundRect(ctx, badgeX, badgeY, totalWidth, badgeH, 12);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    let currentX = badgeX + padding;
    const centerY = badgeY + badgeH / 2;

    if (logo) {
        const r = logoSize / 2;
        const cx = currentX + r;
        const cy = centerY;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        drawImageCover(
            ctx,
            logo,
            cx - r,
            cy - r,
            logoSize,
            logoSize
        );

        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();

        currentX += logoSize + gap;
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#6B7280';
    ctx.fillText(labelText, currentX, centerY - 4);

    if (sponsorName) {
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = textColor;
        ctx.fillText(
            sponsorName.toUpperCase(),
            currentX,
            centerY + 14
        );
    } else if (!logo) {
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = textColor;
        ctx.fillText('SPONSOR', currentX, centerY + 14);
    }

    ctx.restore();
};
``