export function normalizeEmployeeId(value: string) {
  return value.trim().toUpperCase();
}

export function getGateAuthEmail(employeeId: string) {
  return `gate.${normalizeEmployeeId(employeeId).toLowerCase()}@auth.usls-oas.local`;
}