"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LinkState = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // The client exchanges the code in the reset link for a session on load and emits PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setLinkState("ready");
    });

    const hasLinkError = /error_description=/.test(window.location.search + window.location.hash);
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setLinkState((current) => (current === "ready" ? current : data.session && !hasLinkError ? "ready" : "invalid"));
    }, 1500);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password.length > 128) { setError("Password is too long (max 128 characters)."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      setDone(true);
      setTimeout(() => { router.push("/admin"); router.refresh(); }, 1500);
    } catch {
      setError("Could not update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-24 sm:h-20 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Set a New Password</h1>
          <p className="text-gray-500 text-sm mt-1">USLS Online Appointment System</p>
        </div>

        <div className="card">
          {linkState === "checking" ? (
            <div className="py-6 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-3" />
              <p className="text-sm text-gray-500">Checking your reset link...</p>
            </div>
          ) : linkState === "invalid" ? (
            <div className="text-center space-y-3" role="alert">
              <p className="text-sm text-gray-700">This reset link is invalid or has expired. Reset links only work once, in the same browser that requested them.</p>
              <Link href="/admin/forgot-password" className="btn-primary inline-block">Request a new link</Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-2" role="status">
              <p className="text-sm font-medium text-green-700">Password updated.</p>
              <p className="text-xs text-gray-500">Taking you to the dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div>
                <label htmlFor="new-password" className="label">New Password</label>
                <div className="relative">
                  <input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10" placeholder="Minimum 8 characters" required minLength={8} maxLength={128} autoComplete="new-password" autoFocus />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm-password" className="label">Confirm New Password</label>
                <input id="confirm-password" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input" placeholder="Re-enter new password" required autoComplete="new-password" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Saving..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
