import { notFound } from "next/navigation";
import StudioLab from "@/components/admin/Broadcaster/show/StudioLab";

// Development-only harness: runs the REAL AI program engine (data → editorial →
// director → Virtual Studio) without the admin panel, for automated browser tests
// and measurements. Production returns 404.
export const metadata = { robots: { index: false, follow: false } };

export default function StudioLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StudioLab />;
}
