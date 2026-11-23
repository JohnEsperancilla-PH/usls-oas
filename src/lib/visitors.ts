// Most people one appointment can bring in under a single QR code, the person booking included.
// The database allows the same (migration 054). Larger groups where guests arrive separately
// belong in Campus Entry, where each guest gets their own code.
export const MAX_VISITORS = 50;
