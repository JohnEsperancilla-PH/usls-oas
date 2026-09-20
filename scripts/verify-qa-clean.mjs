import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const env = Object.fromEntries(
  readFileSync(path.join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const run = async (label, fn) => {
  const { data, error } = await fn();
  console.log(`${label}:`, error ? "ERR " + error.message : JSON.stringify(data));
};
await run("appointments named QA Smoke*, remaining", () =>
  sb.from("appointments").select("id, full_name, status").or("full_name.ilike.%QA Smoke%,email.ilike.%qa.smoke%"));
await run("email_logs for qa.smoke", () =>
  sb.from("email_logs").select("id, type, to_email").or("to_email.ilike.%qa.smoke%"));
await run("audit_logs mentioning QA smoke", () =>
  sb.from("audit_logs").select("id, action").ilike("details", "%QA Smoke%"));
await run("visitors with qa.smoke email", () =>
  sb.from("appointment_visitors").select("id").or("email.ilike.%qa.smoke%"));
console.log("DONE");
