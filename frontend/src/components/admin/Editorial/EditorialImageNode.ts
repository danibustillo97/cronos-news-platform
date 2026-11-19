// Evolución del Artifact section 6-8: a real ProseMirror block node --
// this IS the "document has a real image block, not a side panel"
// requirement, expressed the same way Tiptap already expresses
// paragraphs/headings (a real node in the same document tree, section 6:
// "utilizar el modelo existente", never a second representation).
//
// Deliberately stores ONLY the placeholder_id in content_html
// (<figure data-placeholder-id="...">) -- never the image src, caption,
// or alt text. Those live exactly once, on the real MediaRequirement
// (see EditorialImageContext), resolved at render time. This is what
// keeps position (content_html) and content (media_requirements) from
// ever drifting apart.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import EditorialImageView from "./EditorialImageView";

export interface EditorialImageOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    editorialImage: {
      insertEditorialImage: (placeholderId: string) => ReturnType;
    };
  }
}

const EditorialImageNode = Node.create<EditorialImageOptions>({
  name: "editorialImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      placeholderId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-placeholder-id"),
        renderHTML: (attrs) => (attrs.placeholderId ? { "data-placeholder-id": attrs.placeholderId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-placeholder-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorialImageView);
  },

  addCommands() {
    return {
      insertEditorialImage:
        (placeholderId: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { placeholderId } }),
    };
  },
});

export default EditorialImageNode;
