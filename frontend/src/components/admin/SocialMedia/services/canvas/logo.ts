import { drawRoundRect } from './primitives';

export const drawLogo = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale = 1,
    darkText = false
) => {
    const size = 70 * scale;
    const padding = 20 * scale;

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#DC2626';

    drawRoundRect(ctx, x, y, size, size, 12 * scale);
    ctx.shadowBlur = 0;

    ctx.font = `900 ${42 * scale}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', x + size / 2, y + size / 2);

    ctx.textAlign = 'left';
    ctx.font = `900 ${48 * scale}px Arial`;
    ctx.fillStyle = darkText ? '#111111' : '#FFFFFF';
    ctx.fillText('NEXUS', x + size + padding, y + size / 2);

    const nexusWidth = ctx.measureText('NEXUS').width;
    ctx.fillStyle = '#DC2626';
    ctx.fillText('NEWS', x + size + padding + nexusWidth, y + size / 2);
};