import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowlist } from "./allowlist";
import { safeNextPath } from "./safe-next";

describe("allowlist", () => {
  it("parses comma and whitespace separated lists", () => {
    expect(parseAllowlist(" A@x.de, b@y.com ;c@z.org ")).toEqual(["a@x.de", "b@y.com", "c@z.org"]);
    expect(parseAllowlist("")).toBeNull();
    expect(parseAllowlist(undefined)).toBeNull();
  });

  it("allows everyone when no list is configured", () => {
    expect(isEmailAllowed("someone@example.com", undefined)).toBe(true);
  });

  it("enforces the list case-insensitively", () => {
    expect(isEmailAllowed("Me@Example.com", "me@example.com")).toBe(true);
    expect(isEmailAllowed("other@example.com", "me@example.com")).toBe(false);
    expect(isEmailAllowed(null, "me@example.com")).toBe(false);
  });
});

describe("safe redirect targets", () => {
  it("only allows same-origin paths", () => {
    expect(safeNextPath("/planner?d=1")).toBe("/planner?d=1");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
