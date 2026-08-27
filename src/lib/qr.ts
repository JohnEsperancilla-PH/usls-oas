import crypto from "crypto";

export function getQRSecret(): string {
  const secret = process.env.QR_SECRET;
  if (!secret || secret === "default-secret-key") {
    throw new Error("QR_SECRET environment variable must be set to a secure random string");
  }
  return secret;
}

export function generateQRToken(appointmentId: string): string {
  const secret = getQRSecret();
  const payload = JSON.stringify({
    appointmentId,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
  });

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const signature = hmac.digest("hex");

  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64");
}

export function verifyQRToken(token: string): { valid: boolean; appointmentId?: string } {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString());
    const { payload, signature } = decoded;

    const secret = getQRSecret();
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) {
      return { valid: false };
    }

    const payloadData = JSON.parse(payload);
    return { valid: true, appointmentId: payloadData.appointmentId };
  } catch {
    return { valid: false };
  }
}
