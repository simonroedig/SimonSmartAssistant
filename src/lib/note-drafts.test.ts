import { describe, expect, it } from "vitest";
import { draftMatches, findLinks } from "./note-drafts";

describe("note drafts", () => {
  it("knows when the server has exactly what was typed", () => {
    const draft = { id: "a", title: " Codes ", body: "4711\n\n", categoryId: null };
    expect(draftMatches(draft, { title: "Codes", body: "4711" })).toBe(true);
    expect(draftMatches(draft, { title: "Codes", body: "4712" })).toBe(false);
    expect(draftMatches({ ...draft, title: "" }, { title: null, body: "4711" })).toBe(true);
  });

  it("finds the web links in a note", () => {
    expect(
      findLinks("Login: https://portal.example.com/login, also see www.x.de and https://example.com/. Done"),
    ).toEqual([
      { href: "https://portal.example.com/login", label: "portal.example.com/login" },
      { href: "https://example.com/", label: "example.com" },
    ]);
    expect(findLinks("javascript:alert(1) ftp://x.y")).toEqual([]);
  });
});

describe("isTransient", async () => {
  const { isTransient } = await import("@/data/core");
  it("tries again only when it could help", () => {
    expect(isTransient(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransient({ code: "PGRST303", message: "JWT expired" })).toBe(true);
    expect(isTransient({ code: "23514", message: "violates check constraint" })).toBe(false);
    expect(isTransient({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
