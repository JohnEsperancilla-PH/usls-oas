const USLS_ADMIN_EMAIL_PATTERN = /^[a-z0-9._%+-]+@usls\.edu\.ph$/i;
const USLS_STUDENT_EMAIL_PATTERN = /^s\d{7}@usls\.edu\.ph$/i;

export type OfficeAdminEmailValidation =
  | { ok: true; email: string }
  | { ok: false; message: string };

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Office admin accounts must use a USLS employee email. Student accounts use
 * the s + 7 digits format (e.g. s2010011@usls.edu.ph) and are not allowed.
 */
export function validateOfficeAdminEmail(rawEmail: string): OfficeAdminEmailValidation {
  const email = normalizeAdminEmail(rawEmail);

  if (!email) {
    return { ok: false, message: "Email is required" };
  }

  if (email.length > 254) {
    return { ok: false, message: "Email is too long (max 254 characters)" };
  }

  if (!USLS_ADMIN_EMAIL_PATTERN.test(email)) {
    return { ok: false, message: "Email must be a valid @usls.edu.ph address" };
  }

  if (USLS_STUDENT_EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      message: "Student email addresses cannot be used for office admin accounts",
    };
  }

  return { ok: true, email };
}
