import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "./markdown";

describe("markdown", () => {
  it("reads a briefing: headings, lists with links, paragraphs", () => {
    const blocks = parseMarkdown(
      [
        "## 🔥 Heute wichtig",
        "- **Gipfel** in Brüssel: es geht um KI. [Quelle](https://example.com/a)",
        "- Zweiter Punkt",
        "  geht hier weiter.",
        "",
        "Ein Absatz",
        "über zwei Zeilen.",
        "",
        "1. eins",
        "2. zwei",
        "---",
        "> Zitat",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "list", "paragraph", "list", "rule", "quote"]);
    expect(blocks[0]).toEqual({ type: "heading", level: 2, children: [{ type: "text", text: "🔥 Heute wichtig" }] });
    const list = blocks[1] as Extract<(typeof blocks)[number], { type: "list" }>;
    expect(list.ordered).toBe(false);
    expect(list.items[0]).toEqual([
      { type: "bold", children: [{ type: "text", text: "Gipfel" }] },
      { type: "text", text: " in Brüssel: es geht um KI. " },
      { type: "link", href: "https://example.com/a", children: [{ type: "text", text: "Quelle" }] },
    ]);
    expect(list.items[1]).toEqual([{ type: "text", text: "Zweiter Punkt geht hier weiter." }]);
    expect(blocks[2]).toEqual({
      type: "paragraph",
      children: [{ type: "text", text: "Ein Absatz über zwei Zeilen." }],
    });
    expect((blocks[3] as { ordered: boolean }).ordered).toBe(true);
  });

  it("only links to web pages – anything else stays plain text", () => {
    expect(parseInline("[klick](javascript:alert(1))")).toEqual([{ type: "text", text: "klick" }]);
    expect(parseInline("<b>fett</b>")).toEqual([{ type: "text", text: "<b>fett</b>" }]);
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(parseInline("Siehe https://example.com/x.")).toEqual([
      { type: "text", text: "Siehe " },
      { type: "link", href: "https://example.com/x", children: [{ type: "text", text: "https://example.com/x" }] },
      { type: "text", text: "." },
    ]);
  });

  it("emphasis and code", () => {
    expect(parseInline("*kursiv* und `code` und __fett__")).toEqual([
      { type: "italic", children: [{ type: "text", text: "kursiv" }] },
      { type: "text", text: " und " },
      { type: "code", text: "code" },
      { type: "text", text: " und " },
      { type: "bold", children: [{ type: "text", text: "fett" }] },
    ]);
    // Snake_case words and a lone star are just text.
    expect(parseInline("snake_case_name 5 * 3")).toEqual([{ type: "text", text: "snake_case_name 5 * 3" }]);
  });
});
