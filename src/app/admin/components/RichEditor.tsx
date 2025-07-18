// src/components/RichEditor.tsx
'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

export default function RichEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content,
    editorProps: {
      attributes: {
        class:
          'prose max-w-none w-full min-h-[300px] outline-none p-4 rounded-md border border-gray-300 shadow-sm bg-white',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false, // ✅ ESTA ES LA CLAVE
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="w-full">
      <EditorContent editor={editor} />
    </div>
  );
}
