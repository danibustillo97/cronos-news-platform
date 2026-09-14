import { drawLogo } from '../logo';

export const renderOutro = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    localTime: number,
    sponsorName: string
) => {
    ctx.save();

    const fade = Math.min(localTime / 800, 1);
    ctx.globalAlpha = fade;

    const bg = ctx.createRadialGradient(
        w / 2, h / 2, 0,
        w / 2, h / 2, w
    );
    bg.addColorStop(0, '#1a0505');
    bg.addColorStop(1, '#000');

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const p = Math.min(Math.max((localTime - 200) / 1200, 0), 1);
    const startScale = 0.7;
    const endScale = 1.8;
    const scale = startScale + (endScale - startScale) * p;

    const endX = (w - 390 * scale) / 2;
    const endY = h / 2 - 150;

    drawLogo(ctx, endX, endY, scale);

    if (localTime > 1200) {
        ctx.textAlign = 'center';
        ctx.font = '900 48px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('SÍGUENOS PARA MÁS', w / 2, h / 2 + 80);

        ctx.font = '900 64px Arial';
        ctx.fillStyle = '#DC2626';
        ctx.fillText('@NEXUSNEWS', w / 2, h / 2 + 150);
    }

    ctx.restore();
};