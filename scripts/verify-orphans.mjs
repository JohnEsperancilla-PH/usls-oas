import { readFileSync } from "node:fs";
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

const DELETED = "a1572752-2cc9-42e8-84ce-9e1a9f97df34";
const run = async (label, fn) => {
  const { data, error } = await fn();
  console.log(`${label}:`, error ? "ERR " + error.message : JSON.stringify(data));
};
await run("closed appointment existed", () => sb.from("appointments").select("id").eq("id", DELETED));
await run("appointment_visitors orphan refs", () => sb.from("appointment_visitors").select("id").eq("appointment_id", DELETED));
await run("appointment_vehicles orphan refs", () => sb.from("appointment_vehicles").select("id").eq("appointment_id", DELETED));
await run("email_logs orphan refs", () => sb.from("email_logs").select("id").eq("appointment_id", DELETED));
await run("audit_logs appointments refs", () => sb.from("audit_logs").select("id, action").eq("appointment_id", DELETED));
