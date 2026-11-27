import type { Metadata } from "next";
import BroadcastOutput from "@/components/broadcast/BroadcastOutput";

// Clean Program output for tab capture (KICK Web Go Live, Restream...): no admin UI,
// never indexed. It carries no data of its own: the signal comes from the operator's
// broadcaster tab in this same browser.
export const metadata: Metadata = {
  title: "NEXUS SPORT · Salida de emisión",
  robots: { index: false, follow: false },
};

export default function BroadcastOutputPage() {
  return <BroadcastOutput />;
}
