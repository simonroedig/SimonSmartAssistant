/**
 * Security integration tests against a local Supabase stack (`supabase start`).
 *
 * They prove the guarantees the app relies on:
 *  - anonymous requests cannot read or write anything,
 *  - sign-ups are rejected unless the e-mail is allowlisted (auth hook),
 *  - every row is isolated per user by RLS,
 *  - triggers and constraints keep the data consistent.
 *
 * Run with: npm run test:integration
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/lib/database.types";

const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE_KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const MAILPIT_URL = process.env.SUPABASE_TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";

type Client = SupabaseClient<Database>;

const TABLES = ["user_settings", "shopping_items", "shopping_history", "todos", "plan_blocks", "day_notes"] as const;

function newClient(): Client {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function latestCodeFor(email: string, after: number): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const body = (await res.json()) as {
      messages: { ID: string; Created: string; Snippet: string }[];
    };
    const fresh = body.messages.find((m) => new Date(m.Created).getTime() >= after - 1000);
    if (fresh) {
      const match = fresh.Snippet.match(/\b(\d{8})\b/);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No sign-in code arrived for ${email}`);
}

async function signIn(email: string): Promise<{ client: Client; userId: string }> {
  const client = newClient();
  const requestedAt = Date.now();
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
  const token = await latestCodeFor(email, requestedAt);
  const { data, error: verifyError } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (verifyError) throw verifyError;
  return { client, userId: data.user!.id };
}

describe("database security", () => {
  let alice: { client: Client; userId: string };
  let bob: { client: Client; userId: string };

  beforeAll(async () => {
    alice = await signIn("dev@example.com");
    // Mailpit + OTP have a per-address send interval; a second address avoids it.
    bob = await signIn("dev2@example.com");

    // Start every run from a clean slate for both test users.
    for (const { client, userId } of [alice, bob]) {
      for (const table of TABLES) {
        await client.from(table).delete().eq("user_id", userId);
      }
    }
  }, 60_000);

  it("rejects sign-ups for e-mails that are not allowlisted", async () => {
    const { error } = await newClient().auth.signInWithOtp({
      email: `intruder-${Date.now()}@example.com`,
      options: { shouldCreateUser: true },
    });
    expect(error).not.toBeNull();
    expect(error?.status).toBe(403);
  });

  it("gives anonymous requests no access at all", async () => {
    const anon = newClient();
    for (const table of TABLES) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(data, table).toBeNull();
      expect(error?.code, table).toBe("42501");
    }
    const { error: insertError } = await anon.from("todos").insert({ title: "nope" });
    expect(insertError?.code).toBe("42501");
  });

  it("does not let clients call the auth hook directly", async () => {
    const { error } = await alice.client.rpc("hook_before_user_created", {
      event: { user: { email: "dev@example.com" } },
    });
    expect(error?.code).toBe("42501");
  });

  it("lets the keep-alive ping through for anonymous callers", async () => {
    const { data, error } = await newClient().rpc("keepalive");
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("isolates rows between users", async () => {
    const { data: todo, error } = await alice.client
      .from("todos")
      .insert({ title: "Alice's secret plan" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(todo!.user_id).toBe(alice.userId);

    const { data: seenByBob } = await bob.client.from("todos").select("*");
    expect(seenByBob).toEqual([]);

    const { data: updated } = await bob.client.from("todos").update({ title: "hijacked" }).eq("id", todo!.id).select();
    expect(updated).toEqual([]);

    const { data: deleted } = await bob.client.from("todos").delete().eq("id", todo!.id).select();
    expect(deleted).toEqual([]);

    const { data: stillThere } = await alice.client.from("todos").select("title").eq("id", todo!.id).single();
    expect(stillThere?.title).toBe("Alice's secret plan");
  });

  it("refuses rows written on behalf of somebody else", async () => {
    const { error } = await bob.client.from("todos").insert({ title: "spoof", user_id: alice.userId });
    expect(error?.code).toBe("42501");

    const { data: own } = await bob.client.from("todos").insert({ title: "mine" }).select().single();
    const { error: moveError } = await bob.client.from("todos").update({ user_id: alice.userId }).eq("id", own!.id);
    expect(moveError?.code).toBe("42501");
  });

  it("only links planner blocks to the user's own todos", async () => {
    const { data: aliceTodo } = await alice.client.from("todos").insert({ title: "linked" }).select().single();

    const { error } = await bob.client.from("plan_blocks").insert({
      day: "2026-10-06",
      start_min: 540,
      end_min: 600,
      title: "steal link",
      todo_id: aliceTodo!.id,
    });
    expect(error?.code).toBe("23503");

    const { data: block, error: ownError } = await alice.client
      .from("plan_blocks")
      .insert({ day: "2026-10-06", start_min: 540, end_min: 600, title: "Work on it", todo_id: aliceTodo!.id })
      .select()
      .single();
    expect(ownError).toBeNull();

    await alice.client.from("todos").delete().eq("id", aliceTodo!.id);
    const { data: after } = await alice.client.from("plan_blocks").select("todo_id").eq("id", block!.id).single();
    expect(after?.todo_id).toBeNull();
  });

  it("validates planner time ranges", async () => {
    const { error } = await alice.client
      .from("plan_blocks")
      .insert({ day: "2026-10-06", start_min: 600, end_min: 600, title: "zero length" });
    expect(error?.code).toBe("23514");

    const { error: overflow } = await alice.client
      .from("plan_blocks")
      .insert({ day: "2026-10-06", start_min: 1400, end_min: 1500, title: "past midnight" });
    expect(overflow?.code).toBe("23514");
  });

  it("maintains timestamps and shopping suggestions", async () => {
    const { data: item } = await alice.client.from("shopping_items").insert({ name: " Hafermilch " }).select().single();
    expect(item!.checked_at).toBeNull();

    const { data: checked } = await alice.client
      .from("shopping_items")
      .update({ checked: true })
      .eq("id", item!.id)
      .select()
      .single();
    expect(checked!.checked_at).not.toBeNull();

    const { data: unchecked } = await alice.client
      .from("shopping_items")
      .update({ checked: false })
      .eq("id", item!.id)
      .select()
      .single();
    expect(unchecked!.checked_at).toBeNull();

    await alice.client.from("shopping_items").insert({ name: "hafermilch" });
    const { data: history } = await alice.client.from("shopping_history").select("*");
    expect(history).toHaveLength(1);
    expect(history![0]).toMatchObject({ name_key: "hafermilch", name: "hafermilch", use_count: 2 });

    const { data: bobHistory } = await bob.client.from("shopping_history").select("*");
    expect(bobHistory).toEqual([]);

    const { data: todo } = await alice.client.from("todos").insert({ title: "finish", done: true }).select().single();
    expect(todo!.done_at).not.toBeNull();
  });

  it("keeps settings private and validated", async () => {
    const { error } = await alice.client.from("user_settings").upsert({ user_id: alice.userId });
    expect(error).toBeNull();
    const { data: settings } = await alice.client.from("user_settings").select("*").single();
    expect(Array.isArray(settings!.sleep_schedule)).toBe(true);

    const { error: invalid } = await alice.client
      .from("user_settings")
      .update({ sleep_schedule: [{ wake: 420, bed: 1380 }] })
      .eq("user_id", alice.userId);
    expect(invalid?.code).toBe("23514");

    const { data: bobView } = await bob.client.from("user_settings").select("*").eq("user_id", alice.userId);
    expect(bobView).toEqual([]);
  });

  it("supports the upserts the app uses", async () => {
    await alice.client.from("user_settings").delete().eq("user_id", alice.userId);
    const { data: created, error } = await alice.client
      .from("user_settings")
      .upsert({ preferences: {} }, { onConflict: "user_id", ignoreDuplicates: true })
      .select()
      .maybeSingle();
    expect(error).toBeNull();
    expect(created?.user_id).toBe(alice.userId);

    const { data: again } = await alice.client
      .from("user_settings")
      .upsert({ preferences: {} }, { onConflict: "user_id", ignoreDuplicates: true })
      .select()
      .maybeSingle();
    expect(again).toBeNull();

    const first = await alice.client
      .from("day_notes")
      .upsert({ day: "2026-10-06", focus: "Ship it" }, { onConflict: "user_id,day" });
    expect(first.error).toBeNull();
    const second = await alice.client
      .from("day_notes")
      .upsert({ day: "2026-10-06", focus: "Ship it!" }, { onConflict: "user_id,day" });
    expect(second.error).toBeNull();
    const { data: notes } = await alice.client.from("day_notes").select("*");
    expect(notes).toHaveLength(1);
    expect(notes![0].focus).toBe("Ship it!");
  });
});
