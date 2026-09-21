export function getTokenSecret(): string {
  const secret = process.env.QR_SECRET;
  const weakSecrets = ["default-secret-key", "changeme", "secret", "test", "password", "123456"];
  
  if (!secret || weakSecrets.includes(secret.toLowerCase())) {
    throw new Error("QR_SECRET must be set to a strong random value (min 32 characters)");
  }
  
  if (secret.length < 32) {
    throw new Error("QR_SECRET must be at least 32 characters long");
  }
  
  return secret;
}