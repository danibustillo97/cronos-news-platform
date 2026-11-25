// Pure helpers for the "Anuncios" manager (tested in adSlots.test.ts).

export type AdDevice = "mobile" | "tablet" | "desktop";
export type Size = [number, number] | null;

export interface AdCampaign {
  id: string;
  placement: string;
  advertiser: string;
  href: string;
  alt: string | null;
  images: Record<AdDevice, string | null>;
  startsAt: string | null;
  endsAt: string | null;
  weight: number;
  active: boolean;
  live: boolean;
  impressions: number;
  clicks: number;
}

export interface AdSlotAdmin {
  placement: string;
  name: string;
  page: string;
  where: string;
  sizes: Record<AdDevice, Size>;
  enabled: boolean;
  campaigns: AdCampaign[];
}

export interface CampaignDraft {
  id?: string;
  advertiser: string;
  href: string;
  alt: string;
  images: Record<AdDevice, string | null>;
  startsAt: string;
  endsAt: string;
  weight: number;
}

export const DEVICE_LABEL: Record<AdDevice, string> = { mobile: "Móvil", tablet: "Tablet", desktop: "Computador" };

export const emptyCampaign = (): CampaignDraft => ({
  advertiser: "", href: "https://", alt: "", images: { mobile: null, tablet: null, desktop: null }, startsAt: "", endsAt: "", weight: 1,
});

export function sizeLabel(size: Size): string {
  return size ? `${size[0]}×${size[1]}` : "—";
}

/** A creative fits when it is the exact size or exactly 2× (retina). */
export function imageFitsSlot(dims: { width: number; height: number }, size: [number, number]): boolean {
  return (dims.width === size[0] && dims.height === size[1]) || (dims.width === size[0] * 2 && dims.height === size[1] * 2);
}

export function ctr(impressions: number, clicks: number): string {
  if (!impressions) return "—";
  return `${((clicks / impressions) * 100).toFixed(2).replace(".", ",")}%`;
}

/** Plain-text spec sheet to send to an advertiser (email / WhatsApp). */
export function specSheetText(slots: AdSlotAdmin[]): string {
  const lines = ["NEXUS Fútbol · Medidas de publicidad", "Formatos: JPG, PNG o WebP · máximo 150 KB · enviar también la versión al doble (retina) si es posible.", ""];
  for (const s of slots) {
    lines.push(`• ${s.name} — ${s.where}`);
    for (const d of ["mobile", "tablet", "desktop"] as const) {
      const size = s.sizes[d];
      if (size) lines.push(`   ${DEVICE_LABEL[d]}: ${size[0]}×${size[1]} px`);
    }
  }
  return lines.join("\n");
}
