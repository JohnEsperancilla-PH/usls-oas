import crypto from "crypto";
import { getTokenSecret } from "@/lib/secret";

export type ActionType = "approve" | "decline";

export interface ActionTokenPayload {
  appointmentId: string;
  action: ActionType;
  adminEmail: string;
  officeId: string | null;
  iat: number;
  exp: number;
}

const ACTION_TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 72 hours

export function generateActionToken(opts: {
  appointmentId: string;
  action: ActionType;
  adminEmail: string;
  officeId?: string | null;
}): string {
  const secret = getTokenSecret();
  const now = Date.now();
  const payload = JSON.stringify({
    appointmentId: opts.appointmentId,
    action: opts.action,
    adminEmail: opts.adminEmail,
    officeId: opts.officeId || null,
    iat: now,
    exp: now + ACTION_TOKEN_TTL_MS,
    nonce: crypto.randomUUID(),
  });

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const signature = hmac.digest("hex");

  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64");
}

export function verifyActionToken(
  token: string,
  expectedAction: ActionType
): { valid: boolean; payload?: ActionTokenPayload; error?: "invalid" | "expired" | "action" } {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    const { payload, signature } = decoded;

    const secret = getTokenSecret();
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) {
      return { valid: false, error: "invalid" };
    }

    const data = JSON.parse(payload) as ActionTokenPayload;

    if (data.action !== expectedAction) {
      return { valid: false, error: "action" };
    }

    if (Date.now() > data.exp) {
      return { valid: false, error: "expired" };
    }

    return { valid: true, payload: data };
  } catch {
    return { valid: false, error: "invalid" };
  }
}