"use client";
import { useEditorWorkspace } from '@/context/EditorWorkspaceContext';
import FloatingEditorWindow from './FloatingEditorWindow';
import WorkspaceDock from './WorkspaceDock';

export default function GlobalWorkspaceOverlay() {
  const { activeDrafts, minimizedDrafts } = useEditorWorkspace();


  if (activeDrafts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {activeDrafts.map(draft => (
        !minimizedDrafts.includes(draft.id) && (
            <div key={draft.id} className="absolute inset-0">
                <FloatingEditorWindow draft={draft} />
            </div>
        )
      ))}


      <div className="pointer-events-auto">
         <WorkspaceDock />
      </div>
    </div>
  );
}
