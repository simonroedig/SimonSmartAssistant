import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, backupFileName } from "./backup";

describe("backup", () => {
  it("takes every table of the app along (a new table must be added to the backup)", () => {
    const types = readFileSync(new URL("./database.types.ts", import.meta.url), "utf8");
    const publicTables = types.slice(types.indexOf("public: {"));
    const tables = publicTables.slice(publicTables.indexOf("Tables: {"), publicTables.indexOf("Views: {"));
    const names = [...tables.matchAll(/^ {6}([a-z_]+): \{$/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    expect([...BACKUP_TABLES].sort()).toEqual(names.sort());
  });

  it("names the file after the day", () => {
    expect(backupFileName(new Date(2026, 10, 23, 9))).toBe("smart-assistant-backup-2026-11-23.json");
  });
});
