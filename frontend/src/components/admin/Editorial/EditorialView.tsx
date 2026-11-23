"use client";

import EditorialBoard from "@/components/admin/Editorial/EditorialBoard";

// Editorial = one Kanban board (Entrantes → Redactando → Por revisar →
// Programadas → Publicadas). The old four tabs (Noticias / Descubrir IA /
// Editor / Cola IA) and their two separate news systems were merged here.
export default function EditorialView() {
  return <EditorialBoard />;
}
