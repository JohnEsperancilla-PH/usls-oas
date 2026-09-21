export function sanitizeString(input: string | undefined | null, maxLength: number = 255): string | null {
  if (input === undefined || input === null) return null;
  
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  
  return trimmed.slice(0, maxLength);
}

export function sanitizeEmail(input: string | undefined | null): string | null {
  if (input === undefined || input === null) return null;
  
  const trimmed = String(input).trim().toLowerCase();
  if (trimmed.length === 0) return null;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed) || trimmed.length > 254) return null;
  
  return trimmed;
}

export function sanitizeName(input: string | undefined | null, maxLength: number = 100): string | null {
  if (input === undefined || input === null) return null;
  
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  
  return trimmed.slice(0, maxLength);
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
