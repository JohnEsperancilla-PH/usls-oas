export function normalizeEmployeeId(value: string) {
  return value.trim().toUpperCase();
}

// Escape LIKE/ILIKE wildcards so user input is matched literally.
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function getGateAuthEmail(employeeId: string) {
  return `gate.${normalizeEmployeeId(employeeId).toLowerCase()}@auth.usls-oas.local`;
}
