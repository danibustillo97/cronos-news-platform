// /app/admin/layout.tsx
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>
        <main className="min-h-screen bg-black text-gray-100 flex items-center justify-center">
          <div className="w-full max-w-4xl mx-auto p-8 rounded-3xl shadow-2xl bg-[#181818] border border-yellow-400/30">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
