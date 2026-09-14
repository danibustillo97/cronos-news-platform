
"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface NewsDraft {
  id: string;
  title: string;
  content?: string;
  image_url: string;
  published_at: string;
  category?: string;
  subcategory?: string;
  subtitle?: string;
  author?: string;
  tags?: string[];
  description?: string;
  slug: string;
  status?: string;
  localChanges?: boolean; // If true, needs sync
}

interface EditorWorkspaceContextType {
  activeDrafts: NewsDraft[];
  minimizedDrafts: string[]; // IDs of minimized drafts
  openEditor: (draft: NewsDraft) => void;
  closeEditor: (id: string) => void;
  minimizeEditor: (id: string) => void;
  maximizeEditor: (id: string) => void;
  updateDraft: (id: string, data: Partial<NewsDraft>, markAsLocalChange?: boolean) => void;
}

const EditorWorkspaceContext = createContext<EditorWorkspaceContextType | undefined>(undefined);

export function EditorWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeDrafts, setActiveDrafts] = useState<NewsDraft[]>([]);
  const [minimizedDrafts, setMinimizedDrafts] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('workspace_active_drafts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveDrafts(parsed);
        // Start with all drafts minimized so they don't block the view on load
        setMinimizedDrafts(parsed.map((d: NewsDraft) => d.id));
      } catch (e) {
        console.error("Failed to load workspace state", e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('workspace_active_drafts', JSON.stringify(activeDrafts));
  }, [activeDrafts]);

  const openEditor = (draft: NewsDraft) => {
    setActiveDrafts(prev => {
      const exists = prev.find(d => d.id === draft.id);
      if (exists) {
        // Move to end (top) and unminimize, AND UPDATE DATA
        setMinimizedDrafts(m => m.filter(id => id !== draft.id));
        return [...prev.filter(d => d.id !== draft.id), { ...exists, ...draft }];
      }
      return [...prev, draft];
    });
  };

  const closeEditor = (id: string) => {
    setActiveDrafts(prev => prev.filter(d => d.id !== id));
    setMinimizedDrafts(prev => prev.filter(mid => mid !== id));
  };

  const minimizeEditor = (id: string) => {
    setMinimizedDrafts(prev => [...prev, id]);
  };

  const maximizeEditor = (id: string) => {
    // Unminimize and move to end
    setMinimizedDrafts(prev => prev.filter(mid => mid !== id));
    setActiveDrafts(prev => {
        const draft = prev.find(d => d.id === id);
        if (!draft) return prev;
        return [...prev.filter(d => d.id !== id), draft];
    });
  };

  const updateDraft = (id: string, data: Partial<NewsDraft>, markAsLocalChange: boolean = true) => {
    setActiveDrafts(prev => prev.map(d => d.id === id ? { 
        ...d, 
        ...data, 
        localChanges: markAsLocalChange ? true : d.localChanges 
    } : d));
  };

  return (
    <EditorWorkspaceContext.Provider value={{
      activeDrafts,
      minimizedDrafts,
      openEditor,
      closeEditor,
      minimizeEditor,
      maximizeEditor,
      updateDraft
    }}>
      {children}
    </EditorWorkspaceContext.Provider>
  );
}

export function useEditorWorkspace() {
  const context = useContext(EditorWorkspaceContext);
  if (context === undefined) {
    throw new Error('useEditorWorkspace must be used within a EditorWorkspaceProvider');
  }
  return context;
}
