// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { convertBlock, parseHtml, serialize, wordCount, youtubeId, type Block } from "./blockModel";

const types = (blocks: Block[]) => blocks.map((b) => b.type);

describe("blockModel", () => {
  it("parses the portal's HTML into editable blocks", () => {
    const blocks = parseHtml(`<article>
      <p>Primer <strong>párrafo</strong>.</p><h2>Subtítulo</h2><h3>Menor</h3>
      <blockquote><p>Una cita</p></blockquote><ul><li>uno</li><li>dos</li></ul>
      <figure><img src="https://cdn/x.jpg" alt="Gol"><figcaption>Foto: AP</figcaption></figure>
      <figure><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe></figure><hr>
      <figure data-placeholder-id="BODY_IMAGE_01"></figure><table><tr><td>1</td></tr></table></article>`);
    expect(types(blocks)).toEqual(["paragraph", "heading", "heading", "quote", "list", "image", "embed", "divider", "placeholder", "raw"]);
    expect(blocks[5]).toMatchObject({ src: "https://cdn/x.jpg", alt: "Gol", caption: "Foto: AP" });
    expect(blocks[6]).toMatchObject({ videoId: "dQw4w9WgXcQ" });
  });

  it("round-trips without losing content", () => {
    const html = `<article><p>Hola <em>mundo</em></p><h2>Sub</h2><blockquote><p>Cita</p></blockquote><ul><li>a</li></ul><figure><img src="https://cdn/x.jpg" alt="A" /><figcaption>Pie</figcaption></figure><hr /><figure data-placeholder-id="P1"></figure><table><tbody><tr><td>1</td></tr></tbody></table></article>`;
    const again = serialize(parseHtml(serialize(parseHtml(html))));
    expect(again).toBe(serialize(parseHtml(html)));
    expect(again).toContain("<table>");
    expect(again).toContain('data-placeholder-id="P1"');
  });

  it("turns plain text and wrapper divs into paragraphs", () => {
    expect(types(parseHtml("solo texto"))).toEqual(["paragraph"]);
    expect(types(parseHtml("<div><p>a</p><p>b</p></div><div>suelto</div>"))).toEqual(["paragraph", "paragraph", "paragraph"]);
  });

  it("strips scripts, handlers and foreign iframes", () => {
    const html = serialize(parseHtml(`<p onclick="x()">ok<script>alert(1)</script></p><iframe src="https://evil.test/x"></iframe>`));
    expect(html).not.toMatch(/script|onclick/);
    expect(html).toContain("<p>ok</p>");
    // non-YouTube iframes stay as raw HTML -- the portal's sanitizer removes them on render
    expect(html).toContain("evil.test");
  });

  it("drops empty blocks and images without a source", () => {
    expect(serialize([
      { id: "1", type: "paragraph", html: "   " }, { id: "2", type: "image", src: "", caption: "", alt: "" },
      { id: "3", type: "paragraph", html: "texto" },
    ])).toBe("<article><p>texto</p></article>");
  });

  it("converts between text block types keeping the words", () => {
    const p: Block = { id: "1", type: "paragraph", html: "uno<br>dos" };
    expect(convertBlock(p, "list")).toMatchObject({ type: "list", html: "<li>uno</li><li>dos</li>" });
    expect(convertBlock(convertBlock(p, "list"), "paragraph")).toMatchObject({ html: "uno<br>dos" });
    expect(convertBlock(p, "heading2")).toMatchObject({ type: "heading", level: 2 });
  });

  it("reads YouTube ids from any link shape", () => {
    for (const url of ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"]) expect(youtubeId(url)).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://vimeo.com/1")).toBeNull();
  });

  it("counts words", () => {
    expect(wordCount(parseHtml("<p>uno dos</p><h2>tres</h2><figure><img src='x'></figure>"))).toBe(3);
  });
});
