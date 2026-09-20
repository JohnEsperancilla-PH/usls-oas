import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");
if (!existsSync(envPath)) { console.error("ENV MISSING: " + envPath); process.exit(2); }

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("MISSING supabase env"); process.exit(2); }
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const mark = "%QA Smoke Test%";
const { data: rows, error } = await sb
  .from("appointments")
  .select("id, full_name, email, date, time_slot, office_id, created_at")
  .ilike("full_name", mark);
if (error) { console.error("QUERY ERR:", error.message); process.exit(1); }
console.log("MATCHES:", rows ? rows.length : 0);
if (rows && rows.length) {
  for (const r of rows) {
    console.log(`- ${r.id} | ${r.full_name} | ${r.email} | ${r.date} ${r.date} ${r.time_slot}`);
    for (const [tbl, col] of [
      ["appointment_visitors", "appointment_id"],
      ["appointment_vehicles", "appointment_id"],
      ["email_logs", "appointment_id"],
      ["audit_logs", "appointment_id"],
      ["blocked_times", "appointment_id"],
    ]) {
      const { error: de } = await sb.from(tbl).delete().eq(col, r.id);
      if (de) console.error(`  del ${tbl}: ${de.message}`);
    }
    const { error: da } = await sb.from("appointments").delete().eq("id", r.id);
    if (da) console.error(`  del appointments: ${da.message}`); else console.log("  deleted appointment " + r.id);
  }
}
