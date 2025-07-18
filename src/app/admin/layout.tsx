// app/admin/layout.tsx
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-white shadow p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">Admin Panel</h1>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
