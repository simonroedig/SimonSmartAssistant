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

for (const table of ["plan_blocks", "todos", "shopping_items", "shopping_history", "day_notes", "notes"]) {
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

const items = ["Hafermilch", "Eier", "Bananen", "Vollkornbrot", "Kaffeebohnen", "Spinat", "Feta", "Zahnpasta"];
for (const name of [...items, "Hafermilch", "Bananen", "Kaffeebohnen", "Tomaten", "Pasta", "Joghurt"]) {
  await supabase.from("shopping_items").insert({ name });
}
const { data: all } = await supabase.from("shopping_items").select("*");
const seen = new Set();
for (const row of all) {
  if (seen.has(row.name)) await supabase.from("shopping_items").delete().eq("id", row.id);
  seen.add(row.name);
}
await supabase.from("shopping_items").update({ note: "2x" }).eq("name", "Hafermilch");
await supabase.from("shopping_items").update({ checked: true }).in("name", ["Tomaten", "Pasta", "Joghurt"]);

const { data: todos, error: todoError } = await supabase
  .from("todos")
  .insert(
    [
      { title: "Steuererklärung abschicken\nBelege liegen im Ordner", starred: true, due_date: day(2), position: 1 },
      { title: "Fahrrad zur Inspektion bringen", due_date: day(0), position: 2 },
      { title: "Geschenk für Mama besorgen", due_date: day(9), position: 3 },
      {
        title:
          "Kamera fürs Smart Home recherchieren\nLokal speichernd, kein Cloud-Abo. Am besten PoE und mit RTSP, damit sie später ins Dashboard kann.",
        position: 4,
      },
      { title: "Wohnung: Lampe im Flur tauschen", position: 5 },
      { title: "Arzttermin vereinbaren", starred: true, position: 6 },
      { title: "Backup der Fotos machen", done: true, position: 7 },
    ],
    { defaultToNull: false },
  )
  .select();
if (todoError) throw todoError;

const blocks = [
  { start: t(7, 30), end: t(8, 15), title: "Morning routine", color: "sky" },
  {
    start: t(8, 30),
    end: t(11, 30),
    title: "Deep work: Dashboard",
    color: "violet",
    notes: "Planner drag & drop polish",
  },
  { start: t(11, 30), end: t(12), title: "Emails & admin", color: "slate" },
  { start: t(12, 30), end: t(13, 30), title: "Lunch with Lea", color: "orange" },
  { start: t(14), end: t(16), title: "University: Seminar", color: "indigo" },
  { start: t(15), end: t(15, 30), title: "Call bank", color: "rose" },
  { start: t(16, 30), end: t(17, 30), title: "Gym", color: "emerald" },
  { start: t(18), end: t(18, 45), title: "Groceries", color: "lime" },
  { start: t(19), end: t(20, 30), title: "Cook & dinner", color: "amber" },
  { start: t(21), end: t(22, 30), title: "Read", color: "teal" },
];
await supabase.from("plan_blocks").insert(
  blocks.map((b, i) => ({
    day: day(0),
    start_min: b.start,
    end_min: b.end,
    title: b.title,
    color: b.color,
    notes: b.notes ?? null,
    done: i < 2,
  })),
);
await supabase.from("plan_blocks").insert(
  [
    { day: day(1), start_min: t(9), end_min: t(12), title: "Deep work", color: "violet" },
    { day: day(1), start_min: t(17), end_min: t(18), title: "Gym", color: "emerald" },
    { day: day(-1), start_min: t(10), end_min: t(11), title: "Dentist", color: "rose" },
    {
      day: day(2),
      start_min: t(10),
      end_min: t(11),
      title: todos[0].title.split("\n")[0],
      color: "amber",
      todo_id: todos[0].id,
    },
  ],
  { defaultToNull: false },
);
await supabase
  .from("day_notes")
  .upsert({ day: day(0), focus: "Ship the dashboard planner" }, { onConflict: "user_id,day" });

await supabase.from("notes").insert(
  [
    { title: "WLAN Gäste", body: "Netz: Wohnzimmer-Gast\nPasswort: sonnenblume-42", pinned: true, position: 1 },
    { title: null, body: "Ideen fürs Wochenende: Flohmarkt, Therme, neuen Italiener testen", position: 2 },
    { title: "Geschenkideen", body: "Mama – Kochbuch\nPapa – Fahrradlampe\nLena – Konzertkarten", position: 3 },
    { title: "Pi Display", body: "Settings → This device → Text size 110 %\nNight mode: at night", position: 4 },
  ],
  { defaultToNull: false },
);

console.log("Seeded demo data for", EMAIL);
