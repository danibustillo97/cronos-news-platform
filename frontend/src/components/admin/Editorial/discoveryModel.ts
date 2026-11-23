export interface DiscoveryItem {
  id: string;
  originalTitle: string;
  originalUrl: string;
  rawText: string;
  sourceName: string | null;
  sourceDomain: string;
}

export function sourceLabel(name: string | null, domain: string): string {
  return name && !name.includes("://") ? name : domain;
}
