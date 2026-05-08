export const drawImageCover = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
) => {
    const ratio = Math.max(w / img.width, h / img.height);
    const cx = (w - img.width * ratio) / 2;
    const cy = (h - img.height * ratio) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
        img,
        0, 0, img.width, img.height,
        x + cx, y + cy,
        img.width * ratio, img.height * ratio
    );
    ctx.restore();
};

export const drawRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
};

export const drawErrorPlaceholder = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
) => {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px Arial';
    ctx.fillText('Imagen No Disponible', w / 2, h / 2);
    ctx.font = '20px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('Intenta seleccionar otra noticia', w / 2, h / 2 + 50);
};
