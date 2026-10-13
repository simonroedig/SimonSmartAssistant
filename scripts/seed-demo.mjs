// Fills the LOCAL Supabase stack with realistic demo data for dev@example.com.
// Usage: npx supabase start && node scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const MAILPIT = process.env.SUPABASE_TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";
const EMAIL = process.env.SEED_EMAIL ?? "dev@example.com";

if (!URL.includes("127.0.0.1") && !URL.includes("localhost")) {
  throw new Error("Refusing to seed a non-local Supabase project.");
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const since = Date.now();
const { error: otpError } = await supabase.auth.signInWithOtp({ email: EMAIL, options: { shouldCreateUser: true } });
if (otpError) throw otpError;
let code;
for (let i = 0; i < 40 && !code; i++) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`);
  const body = await res.json();
  const fresh = body.messages.find((m) => new Date(m.Created).getTime() >= since - 1500);
  code = fresh?.Snippet.match(/\b(\d{8})\b/)?.[1];
  if (!code) await new Promise((r) => setTimeout(r, 250));
}
const { error: verifyError } = await supabase.auth.verifyOtp({ email: EMAIL, token: code, type: "email" });
if (verifyError) throw verifyError;

const pad = (n) => String(n).padStart(2, "0");
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const t = (h, m = 0) => h * 60 + m;

for (const table of [
  "plan_blocks",
  "todos",
  "shopping_items",
  "shopping_history",
  "day_notes",
  "notes",
  "note_categories",
  "birthdays",
]) {
  await supabase.from(table).delete().not("user_id", "is", null);
}

await supabase.from("user_settings").upsert({
  location: {
    name: "München",
    region: "Bayern",
    country: "Deutschland",
    latitude: 48.13743,
    longitude: 11.57549,
    timezone: "Europe/Berlin",
  },
  sleep_schedule: [
    { wake: t(7), bed: t(23, 30) },
    { wake: t(7), bed: t(23, 30) },
    { wake: t(7), bed: t(23, 30) },
    { wake: t(7), bed: t(23, 30) },
    { wake: t(7), bed: t(24, 30) },
    { wake: t(9), bed: t(24, 30) },
    { wake: t(9), bed: t(23) },
  ],
});

const check = (result) => {
  if (result.error) throw result.error;
  return result.data;
};

// Shopping: what's often bought (the one-tap suggestions), then today's list.
for (const name of ["Eggs", "Butter", "Apples", "Yoghurt"]) {
  const [row] = check(await supabase.from("shopping_items").insert({ name, position: 0 }).select());
  check(await supabase.from("shopping_items").delete().eq("id", row.id));
}
const list = [
  { name: "Oat milk", note: "2x" },
  { name: "Bananas" },
  { name: "Coffee beans" },
  { name: "Tomatoes", note: "500 g" },
  { name: "Sourdough bread" },
  { name: "Olive oil" },
  { name: "Eggs" },
];
check(
  await supabase
    .from("shopping_items")
    .insert(list.map((item, i) => ({ name: item.name, note: item.note ?? null, position: i + 1 }))),
);
check(await supabase.from("shopping_items").update({ checked: true }).eq("name", "Eggs"));

// Backlog: free text, the first line is the headline.
check(
  await supabase.from("todos").insert(
    [
      { title: "Renew passport", starred: true, due_date: day(5), position: 1 },
      { title: "Plan the trip to Lisbon\nFlights, a place near Alfama, day trip to Sintra.", position: 2 },
      { title: "Call the landlord about the heating", due_date: day(1), position: 3 },
      { title: "Fix the bike's back brake", position: 4 },
      { title: "Back up the photo library", position: 5 },
      { title: "Cancel the old phone contract", done: true, position: 6 },
    ],
    { defaultToNull: false },
  ),
);

// Planner: today (done until mid-morning) and tomorrow.
const today = [
  { start: t(7), end: t(7, 45), title: "Run along the river", color: "emerald", done: true },
  {
    start: t(9),
    end: t(12),
    title: "Deep work – portfolio site",
    color: "violet",
    notes: "Project pages first, then the about page.",
  },
  { start: t(12, 30), end: t(13, 30), title: "Lunch & a short walk", color: "yellow" },
  { start: t(14), end: t(15), title: "Call with the design agency", color: "blue" },
  { start: t(15, 30), end: t(17, 30), title: "Dashboard: polish the notes", color: "indigo" },
  { start: t(18, 30), end: t(20), title: "Bouldering", color: "orange" },
  { start: t(20, 30), end: t(21, 30), title: "Read", color: "slate" },
];
const tomorrow = [
  { start: t(7, 30), end: t(8), title: "Stretching", color: "emerald" },
  { start: t(9), end: t(11, 30), title: "Deep work – case study", color: "violet" },
  { start: t(12), end: t(13), title: "Groceries", color: "lime" },
  { start: t(18), end: t(20), title: "Dinner with friends", color: "rose" },
];
check(
  await supabase.from("plan_blocks").insert(
    [...today.map((b) => ({ ...b, day: day(0) })), ...tomorrow.map((b) => ({ ...b, day: day(1) }))].map((b) => ({
      day: b.day,
      start_min: b.start,
      end_min: b.end,
      title: b.title,
      color: b.color,
      notes: b.notes ?? null,
      done: b.done ?? false,
    })),
  ),
);
check(
  await supabase
    .from("day_notes")
    .upsert({ day: day(0), focus: "Ship the portfolio draft" }, { onConflict: "user_id,day" }),
);

// Notes, some in categories.
const [ideas, travel, recipes] = check(
  await supabase
    .from("note_categories")
    .insert([
      { name: "Ideas", color: "yellow" },
      { name: "Travel", color: "sky" },
      { name: "Recipes", color: "orange" },
    ])
    .select(),
);
check(
  await supabase.from("notes").insert(
    [
      { title: "Guest Wi-Fi", body: "Network: Home-Guest\nPassword: on the fridge", pinned: true, position: 1 },
      {
        title: "Gift ideas",
        body: "Mum – a good chef's knife\nTom – climbing chalk bag\nAnna – the new Murakami",
        position: 2,
        category_id: ideas.id,
      },
      {
        title: "Lisbon",
        body: "Time Out Market\nLX Factory on Sunday\nTram 28 early in the morning",
        position: 3,
        category_id: travel.id,
      },
      {
        title: "Pasta al limone",
        body: "Zest of 2 lemons, butter, parmesan, a splash of pasta water. Black pepper.",
        position: 4,
        category_id: recipes.id,
      },
      {
        title: "Dashboard ideas",
        body: "Habit streaks on the home screen\nWeekly review on Sunday evening",
        position: 5,
        category_id: ideas.id,
      },
      { title: "Books", body: "Project Hail Mary\nThe Design of Everyday Things", position: 6 },
    ],
    { defaultToNull: false },
  ),
);

// A birthday later this month (planner and month calendar).
const soon = new Date();
soon.setDate(soon.getDate() + 6);
check(
  await supabase
    .from("birthdays")
    .insert({ name: "Anna", day: soon.getDate(), month: soon.getMonth() + 1, year: 1994 }),
);

console.log("Seeded demo data for", EMAIL);
