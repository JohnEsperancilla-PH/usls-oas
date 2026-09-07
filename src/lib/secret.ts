export function getTokenSecret(): string {
  const secret = process.env.QR_SECRET;
  if (!secret || secret === "default-secret-key") {
    throw new Error("QR_SECRET environment variable must be set to a secure random string");
  }
  return secret;
}