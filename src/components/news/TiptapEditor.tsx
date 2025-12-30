"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Image as ImageIcon, Quote } from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b border-white/5 bg-transparent mb-4 sticky top-0 z-10 backdrop-blur-md">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-2 rounded hover:bg-white/5 transition-colors ${editor.isActive('bold') ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-neutral-300'}`}
        title="Bold (Cmd+B)"
      >
        <Bold size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-2 rounded hover:bg-white/5 transition-colors ${editor.isActive('italic') ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-neutral-300'}`}
        title="Italic (Cmd+I)"
      >
        <Italic size={18} />
      </button>
      <div className="w-[1px] bg-white/5 h-6 mx-1 self-center"></div>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded hover:bg-white/5 transition-colors ${editor.isActive('bulletList') ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-neutral-300'}`}
        title="Bullet List"
      >
        <List size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded hover:bg-white/5 transition-colors ${editor.isActive('orderedList') ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-neutral-300'}`}
        title="Ordered List"
      >
        <ListOrdered size={18} />
      </button>
      <div className="w-[1px] bg-white/5 h-6 mx-1 self-center"></div>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-2 rounded hover:bg-white/5 transition-colors ${editor.isActive('blockquote') ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-neutral-300'}`}
        title="Quote"
      >
        <Quote size={18} />
      </button>
      <button
        onClick={() => {
            const url = window.prompt('URL');
            if (url) {
                editor.chain().focus().setImage({ src: url }).run();
            }
        }}
        className={`p-2 rounded hover:bg-white/5 transition-colors text-neutral-500 hover:text-neutral-300`}
        title="Add Image"
      >
        <ImageIcon size={18} />
      </button>
    </div>
  )
}

export default function TiptapEditor({ value, onChange, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ 
        inline: false,
        allowBase64: true,
      }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "h-full overflow-y-auto outline-none prose prose-invert max-w-none prose-lg prose-p:text-neutral-300 prose-headings:font-bold prose-headings:text-white prose-a:text-blue-400 prose-strong:text-white prose-blockquote:border-l-2 prose-blockquote:border-white/20 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-400 prose-img:rounded-xl",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    // Only update content if it's significantly different to prevent cursor jumps
    if (editor && value !== editor.getHTML()) {
       // Check if the change is just empty paragraph differences or real content
       if (editor.getHTML() === '<p></p>' && !value) return;
       
       // Only set content if it's actually different to avoid cursor reset
       editor.commands.setContent(value || "");
    }
    // eslint-disable-next-line
  }, [value, editor]);

  if (!editor) return <div className="text-neutral-600 animate-pulse font-mono text-sm">Initializing Text Engine...</div>;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-hidden" />
    </div>
  );
}
