import { mergeAttributes, Node } from "@tiptap/core";

export const EditorialImageGallery = Node.create({
  name: "editorialImageGallery",
  group: "block",
  content: "image+",
  isolating: true,

  parseHTML() {
    return [{ tag: "figure[data-image-gallery]" }];
  },

  renderHTML() {
    return ["figure", { "data-image-gallery": "true" }, 0];
  },
});

export const EditorialVideo = Node.create({
  name: "editorialVideo",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes(HTMLAttributes, { controls: "", preload: "metadata" })];
  },
});
