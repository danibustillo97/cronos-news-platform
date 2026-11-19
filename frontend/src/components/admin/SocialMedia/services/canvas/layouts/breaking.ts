import { drawImageCover } from '../primitives';
import { wrapText } from '../text';

export const renderBreakingLayout = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    customTitle: string,
    fontSize: number
) => {
    drawImageCover(ctx, img, 0, 0, w, h);

    ctx.fillStyle = 'rgba(20, 0, 0, 0.4)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 40;
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.lineTo(400, 80);
    ctx.lineTo(360, 180);
    ctx.lineTo(0, 180);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 60px Arial';
    ctx.fillText('URGENTE', 40, 150);

    const bottomH = h * 0.4;
    const gradient = ctx.createLinearGradient(0, h - bottomH, 0, h);
    gradient.addColorStop(0, 'rgba(220, 38, 38, 0)');
    gradient.addColorStop(1, 'rgba(220, 38, 38, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, h - bottomH, w, bottomH);

    ctx.shadowColor = 'black';
    ctx.shadowBlur = 10;
    ctx.font = `900 ${fontSize + 10}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    wrapText(ctx, customTitle, w / 2, h - 300, w - 180, (fontSize + 10) * 1.1);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
};
