import { describe, expect, it } from "vitest";
import {
  entriesToText,
  NOTE_TEMPLATES,
  parseTemplateText,
  readEntries,
  sortEntries,
  type TemplateEntry,
} from "./note-templates";

const letgo = NOTE_TEMPLATES.letgo;
const day = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;

const entry = (
  id: string,
  at: string,
  values: Record<string, string>,
  done_at: string | null = null,
): TemplateEntry => ({
  id,
  at,
  values,
  done_at,
});

describe("note templates", () => {
  it("reads only well-formed entries", () => {
    expect(readEntries(null)).toEqual([]);
    expect(readEntries([{ id: "a" }, 3, { id: "b", at: "2026-11-10T10:00:00Z", values: { x: "y", n: 1 } }])).toEqual([
      { id: "b", at: "2026-11-10T10:00:00Z", values: { x: "y" }, done_at: null },
    ]);
  });

  it("puts open ones first (newest on top), then the ones checked off last", () => {
    const { open, done } = sortEntries([
      entry("old", "2026-11-01T00:00:00Z", {}),
      entry("new", "2026-11-05T00:00:00Z", {}),
      entry("d1", "2026-10-01T00:00:00Z", {}, "2026-11-02T00:00:00Z"),
      entry("d2", "2026-10-02T00:00:00Z", {}, "2026-11-03T00:00:00Z"),
    ]);
    expect(open.map((e) => e.id)).toEqual(["new", "old"]);
    expect(done.map((e) => e.id)).toEqual(["d2", "d1"]);
  });

  it("writes the entries as text, with the day they were let go", () => {
    const text = entriesToText(
      letgo,
      [
        entry(
          "a",
          "2026-11-10T10:00:00Z",
          { situation: "Handshake", todo: "no", worst: "Nothing", friend: "Relax" },
          "2026-11-10T12:00:00Z",
        ),
        entry("b", "2026-11-11T10:00:00Z", { situation: "Interview", todo: "yes", todo_what: "Send thanks" }),
        entry("empty", "2026-11-11T11:00:00Z", { situation: "  " }),
      ],
      day,
    );
    expect(text).toBe(
      [
        "What happened?\nInterview",
        "Is there anything left to do? Yes: Send thanks",
        "",
        "What happened?\nHandshake",
        "Is there anything left to do? No",
        "Realistically, the worst that comes of it\nNothing",
        "What would I tell a friend?\nRelax",
        "✅ Let go on 10.11.",
      ].join("\n"),
    );
  });
});

describe("parseTemplateText", () => {
  const now = new Date(2026, 10, 11, 20, 0);
  const text = `Situation:
- Spilled coffee in the meeting

1. Gibt es noch etwas zu tun?
- Ja: Nein
- Nein, dann ist es nur noch Grübeln.

2. Realistisch schlimmste Folge:
- Nothing really

3. Nächstes Mal mache ich anders (falls überhaupt):
- Hold the cup with both hands

4. Was würde ich einem Freund sagen?
- Happens to everyone

✅ Abgehakt am: 10. Nov

Situation:
- Forgot a name
1. Gibt es noch etwas zu tun?
- Ja: Apologise next time
`;

  it("reads entries written by hand in the template's shape", () => {
    const [a, b, ...more] = parseTemplateText(letgo, text, now);
    expect(more).toEqual([]);
    expect(a.values).toEqual({
      situation: "Spilled coffee in the meeting",
      todo: "no",
      worst: "Nothing really",
      next: "Hold the cup with both hands",
      friend: "Happens to everyone",
    });
    expect(new Date(a.done_at!).getDate()).toBe(10);
    expect(new Date(a.done_at!).getMonth()).toBe(10);
    expect(b.values).toEqual({ situation: "Forgot a name", todo: "yes", todo_what: "Apologise next time" });
    expect(b.done_at).toBeNull();
    expect(a.id).not.toBe(b.id);
  });

  it("finds nothing in other text", () => {
    expect(parseTemplateText(letgo, "Just a shopping list\n- milk", now)).toEqual([]);
  });
});
