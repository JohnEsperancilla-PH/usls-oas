"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { validateOfficeAdminEmail } from "@/lib/admin-email";
import { adminFetch } from "@/lib/admin-fetch";

interface OfficeOption {
  id: string;
  name: string;
}

interface ApiOffice {
  id: string;
  name: string;
}

export default function AdminRegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "checking" | "available" | "exists" | "error"
  >("idle");
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOffices() {
      try {
        const res = await fetch("/api/offices");
        const data = await res.json();
        if (!cancelled) {
          setOffices(
            Array.isArray(data)
              ? data.map((office: ApiOffice) => ({ id: office.id, name: office.name }))
              : []
          );
        }
      } catch {
        if (!cancelled) setError("Unable to load offices. Please refresh the page.");
      } finally {
        if (!cancelled) setOfficesLoading(false);
      }
    }

    loadOffices();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkEmailAvailability = async (value: string): Promise<boolean> => {
    const emailCheck = validateOfficeAdminEmail(value);
    if (!emailCheck.ok) {
      setEmailStatus("idle");
      setEmailStatusMessage(null);
      return true;
    }

    setEmailStatus("checking");
    setEmailStatusMessage(null);

    try {
      const res = await fetch(
        `/api/admin/register?email=${encodeURIComponent(emailCheck.email)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to check email availability");

      if (data.exists) {
        setEmailStatus("exists");
        setEmailStatusMessage("An account with this email already exists.");
        return false;
      }

      setEmailStatus("available");
      setEmailStatusMessage("Email is available.");
      return true;
    } catch {
      setEmailStatus("error");
      setEmailStatusMessage("Unable to check email availability right now.");
      return true;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailCheck = validateOfficeAdminEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.message);
      return;
    }
    if (!name.trim()) {
      setError("Full name is required");
      return;
    }
    if (!officeId) {
      setError("Please select an office");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password.length > 128) {
      setError("Password is too long (max 128 characters)");
      return;
    }

    if (emailStatus !== "available") {
      const available = await checkEmailAvailability(email);
      if (!available) {
        setError("An account with this email already exists");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: emailCheck.email,
          password,
          officeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      // New accounts wait for super admin approval, so there is no automatic sign-in.
      setSubmittedEmail(emailCheck.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-24 sm:h-20 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Register Office Admin</h1>
          <p className="text-gray-500 text-sm mt-1">USLS Online Appointment System</p>
        </div>

        <div className="card">
          {submittedEmail ? (
            <div className="text-center space-y-3" role="status">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">Waiting for approval</h2>
              <p className="text-sm text-gray-600">
                Your account for <strong>{submittedEmail}</strong> was created. A super admin needs to approve it before you can sign in.
                We&apos;ll email you when it&apos;s approved.
              </p>
            </div>
          ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2 animate-fade-in">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
            <div>
              <label htmlFor="name" className="label">Full Name</label>
              <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                className="input" placeholder="Juan Dela Cruz" required maxLength={100} autoComplete="name" />
            </div>
            <div>
              <label htmlFor="email" className="label">USLS Email</label>
              <input type="email" id="email" value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailStatus("idle");
                  setEmailStatusMessage(null);
                }}
                onBlur={() => {
                  if (email.trim()) checkEmailAvailability(email);
                }}
                className="input" placeholder="name@usls.edu.ph" required maxLength={254} autoComplete="email" />
              {emailStatus === "idle" ? (
                <p className="text-xs text-gray-400 mt-1">
                  Must be an @usls.edu.ph email. Student emails are not allowed.
                </p>
              ) : (
                <p className={`text-xs mt-1 ${
                  emailStatus === "exists"
                    ? "text-red-600"
                    : emailStatus === "available"
                    ? "text-green-600"
                    : emailStatus === "error"
                    ? "text-amber-600"
                    : "text-gray-400"
                }`}>
                  {emailStatus === "checking" ? "Checking availability..." : emailStatusMessage}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} id="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input pr-10" placeholder="Minimum 8 characters"
                  required minLength={8} maxLength={128} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="office" className="label">Assign Office</label>
              <select id="office" value={officeId} onChange={(e) => setOfficeId(e.target.value)}
                className="input" required disabled={officesLoading}>
                <option value="">
                  {officesLoading ? "Loading offices..." : "Select an office"}
                </option>
                {offices.map((office) => (
                  <option key={office.id} value={office.id}>{office.name}</option>
                ))}
              </select>
              {!officesLoading && offices.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  No active offices are available. Please contact a super admin.
                </p>
              )}
            </div>
            <button type="submit" disabled={loading || officesLoading || offices.length === 0}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Creating account...
                </>
              ) : "Create Account"}
            </button>
          </form>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/admin/login" className="font-medium text-primary hover:text-primary-light">
              Sign in
            </Link>
          </div>
        </div>

        <Link href="/" className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-6 transition-colors">
          ← Back to USLS OASYS
        </Link>
      </div>
    </div>
  );
}
