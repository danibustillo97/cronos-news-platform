export type GraphicKind = "lower-third" | "scoreboard" | "ticker";

export interface BroadcastGraphic {
  id: string;
  name: string;
  kind: GraphicKind;
  title: string;
  subtitle: string;
  accent: string;
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function exportGraphicHtml(graphic: BroadcastGraphic): string {
  const title = htmlEscape(graphic.title);
  const subtitle = htmlEscape(graphic.subtitle);
  const accent = /^#[0-9a-f]{6}$/i.test(graphic.accent) ? graphic.accent : "#ef4444";
  const content = graphic.kind === "scoreboard"
    ? `<aside class="score"><strong>${title}</strong><span>${subtitle}</span></aside>`
    : graphic.kind === "ticker"
      ? `<aside class="ticker"><strong>${title}</strong><span>${subtitle}</span></aside>`
      : `<aside class="lower"><i></i><div><strong>${title}</strong><span>${subtitle}</span></div></aside>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEscape(graphic.name)}</title>
<style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;font-family:Inter,Arial,sans-serif;color:#fff}
aside{position:absolute;background:rgba(10,12,16,.92);border:1px solid rgba(255,255,255,.16);box-shadow:0 12px 40px #0006}
.lower{left:5%;bottom:9%;min-width:42%;display:flex;align-items:stretch;border-radius:8px;overflow:hidden}
.lower i{width:8px;background:${accent}}.lower div{padding:16px 22px}.lower strong,.lower span{display:block}.lower strong{font-size:clamp(18px,2.2vw,34px);letter-spacing:.03em}.lower span{margin-top:5px;color:#cbd0d8;font-size:clamp(12px,1.2vw,18px)}
.score{top:6%;right:5%;padding:14px 22px;border-radius:8px;text-align:center}.score strong,.score span{display:block}.score strong{font-size:clamp(16px,2vw,28px)}.score span{margin-top:4px;color:#d1d5db;font-size:clamp(10px,1vw,15px)}
.ticker{left:0;right:0;bottom:0;padding:14px 5%;border:0;border-top:4px solid ${accent};font-size:clamp(16px,1.8vw,26px)}.ticker span{margin-left:24px;color:#cbd0d8;font-size:.78em}
</style></head><body>${content}</body></html>`;
}
