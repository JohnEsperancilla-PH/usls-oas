"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (error) {
        setError(error.status === 429 ? "Too many reset requests. Wait a few minutes and try again." : error.message);
        return;
      }
      // Same message whether or not the account exists, so this page can't be used to discover accounts.
      setSent(true);
    } catch {
      setError("Could not send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-24 sm:h-20 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
          <p className="text-gray-500 text-sm mt-1">We&apos;ll email you a link to set a new password.</p>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center space-y-3" role="status">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-sm text-gray-700">
                If an admin account uses <strong>{email.trim()}</strong>, a reset link is on its way. Open it on this device and browser.
              </p>
              <p className="text-xs text-gray-400">Gate accounts sign in with an employee ID and can&apos;t reset by email. Ask a super admin instead.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input" placeholder="name@usls.edu.ph" required autoComplete="email" autoFocus />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link href="/admin/login" className="text-sm font-medium text-primary hover:underline">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
