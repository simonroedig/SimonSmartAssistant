import { describe, expect, it } from "vitest";
import { matchesSearch, searchTerms } from "./note-search";

describe("note search", () => {
  it("finds every word, in title or text, any order, any case, with or without accents", () => {
    const terms = searchTerms("  door CODE ");
    expect(matchesSearch(terms, "Codes", "Front door: 4711")).toBe(true);
    expect(matchesSearch(terms, "Codes", "Front gate: 4711")).toBe(false);
    expect(matchesSearch(searchTerms("cafe"), null, "Café am Eck")).toBe(true);
    expect(matchesSearch(searchTerms("münchen"), "Trip to Munchen")).toBe(true);
    expect(matchesSearch(searchTerms(""), "anything")).toBe(false);
  });
});
