import { readFileSync } from "fs";
import nodemailer from "nodemailer";

// Manual .env.local parsing
const envContent = readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex > -1) {
    env[trimmed.substring(0, eqIndex)] = trimmed.substring(eqIndex + 1);
  }
}

const user = env.SMTP_USER;
const pass = env.SMTP_PASS;

console.log("SMTP Config:", {
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  user,
  passLength: pass?.length,
  from: env.EMAIL_FROM,
});

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT || "587"),
  secure: false,
  auth: { user, pass },
});

try {
  await transporter.verify();
  console.log("SUCCESS: SMTP connection verified!");
} catch (error) {
  console.error("FAILED:", error instanceof Error ? error.message : error);
}
