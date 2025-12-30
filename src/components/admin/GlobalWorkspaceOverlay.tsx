"use client";
import { useEditorWorkspace } from '@/context/EditorWorkspaceContext';
import FloatingEditorWindow from './FloatingEditorWindow';
import WorkspaceDock from './WorkspaceDock';

export default function GlobalWorkspaceOverlay() {
  const { activeDrafts, minimizedDrafts } = useEditorWorkspace();

  // If no drafts, render nothing (or just the dock if we want it always visible, but usually dock appears with drafts)
  if (activeDrafts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {/* Floating Windows */}
      {activeDrafts.map(draft => (
        !minimizedDrafts.includes(draft.id) && (
            <div key={draft.id} className="absolute inset-0">
                <FloatingEditorWindow draft={draft} />
            </div>
        )
      ))}

      {/* The Dock - Always visible if there are active drafts */}
      <div className="pointer-events-auto">
         <WorkspaceDock />
      </div>
    </div>
  );
}
