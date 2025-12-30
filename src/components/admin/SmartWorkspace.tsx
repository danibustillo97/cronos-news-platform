
"use client";
import AdminNewsManager from './AdminNewsManager';

export default function SmartWorkspace() {
  // Now simpler because the Provider and Floating Windows are global in AppLayoutClient
  return (
    <div className="h-full w-full">
      <AdminNewsManager />
    </div>
  );
}
