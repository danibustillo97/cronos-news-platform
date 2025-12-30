
"use client";
import { useEditorWorkspace } from '@/context/EditorWorkspaceContext';
import { Edit3, X, Maximize2 } from 'lucide-react';

export default function WorkspaceDock() {
  const { activeDrafts, minimizedDrafts, maximizeEditor, closeEditor, openEditor } = useEditorWorkspace();

  if (activeDrafts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-end gap-3 pointer-events-none">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex items-center gap-2 shadow-2xl pointer-events-auto">
         {activeDrafts.map(draft => {
            const isMinimized = minimizedDrafts.includes(draft.id);
            // If not minimized, it's currently open (modal), so we might show it differently or just show all active drafts here as tabs
            
            return (
                    <div key={draft.id} className="group relative">
                        {/* Close Bubble Button */}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (draft.localChanges) {
                                    if (window.confirm("Close this draft? Unsaved changes will be lost.")) {
                                        closeEditor(draft.id);
                                    }
                                } else {
                                    closeEditor(draft.id);
                                }
                            }}
                            className="absolute -top-2 -left-2 z-50 w-5 h-5 bg-red-500 rounded-full text-white items-center justify-center hidden group-hover:flex hover:bg-red-600 transition-colors shadow-lg"
                            title="Close Draft"
                        >
                            <X size={12} />
                        </button>

                        <button 
                            onClick={() => maximizeEditor(draft.id)}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 overflow-hidden ${
                                isMinimized 
                                ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:scale-110' 
                                : 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-110'
                            }`}
                        >
                            {draft.image_url ? (
                                <img src={draft.image_url} className="w-full h-full object-cover opacity-80" />
                            ) : (
                                <Edit3 size={20} />
                            )}
                            
                            {/* Status Dot */}
                            <span className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-black ${draft.localChanges ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                        </button>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {draft.title || "Untitled"}
                    </div>
                </div>
            );
         })}
      </div>
    </div>
  );
}
