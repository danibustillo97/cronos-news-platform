"use client";
import { notFound } from "next/navigation";
import BroadcasterHub from "@/components/admin/Broadcaster/BroadcasterHub";

// Development-only harness: the full broadcaster without the admin login, for automated
// browser tests of the AI program on Program. Production returns 404.
export default function BroadcasterLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <div style={{ height: "100vh" }}><BroadcasterHub active /></div>;
}
