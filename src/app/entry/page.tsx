"use client";

import { useEffect, useState } from "react";
import { formatTimeSlot } from "@/lib/time";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

interface ScanResult {
  success: boolean;
  reason?: string;
  message: string;
  scannedAt?: string;
  checkedOutAt?: string;
  appointment?: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    visitorCategory: string;
    office: string;
    personToMeet: string;
    purposeOfVisit: string;
    date: string;
    timeSlot: string;
    duration: number;
    validId: string;
    referenceNumber: string;
    status: "approved" | "completed" | "entry_denied";
    scannedAt?: string | null;
    checkedOutAt?: string | null;
  };
}

interface ExpectedVisitor {
  id: string;
  fullName: string;
  office: string;
  date: string;
  timeSlot: string;
  status: "approved" | "completed";
  referenceNumber: string;
  checkedOutAt?: string | null;
}

export default function EntryPage() {
  const supabase = createClient();
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [expectedVisitors, setExpectedVisitors] = useState<ExpectedVisitor[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const loadExpectedVisitors = async () => {
    setDashboardLoading(true);
    try {
      const response = await fetch("/api/scan");
      if (!response.ok) return;
      const data = await response.json();
      setExpectedVisitors(data.visitors || []);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/entry/auth")
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => {
        setAuthenticated(data.authenticated === true);
        if (data.authenticated) void loadExpectedVisitors();
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const response = await fetch("/api/entry/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, password }),
      });
      const data: { authenticated?: boolean; message?: string; session?: Session } = await response.json();
      if (!response.ok || !data.authenticated) {
        setAuthError(data.message || "Unable to sign in");
        return;
      }
      if (!data.session) {
        setAuthError("Unable to establish a session. Please try again.");
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession(data.session);
      if (sessionError) {
        setAuthError("Unable to establish a session. Please try again.");
        return;
      }
      setEmployeeId("");
      setPassword("");
      setAuthenticated(true);
      void loadExpectedVisitors();
    } catch {
      setAuthError("Unable to sign in. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthenticated(false);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = reference.trim().toUpperCase();
    if (!value) {
      setError("Please enter a reference number.");
      return;
    }
    setLoading(true);
    setError(null);
    setScanResult(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const data: ScanResult = await response.json();
      setScanResult(data);
    } catch {
      setError("Failed to verify reference number. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScanResult(null);
    setReference("");
    setError(null);
    setDenyReason("");
    void loadExpectedVisitors();
  };

  const handleAllowEntry = async () => {
    const token = scanResult?.appointment?.referenceNumber;
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "allow_entry" }),
      });
      const data: ScanResult = await response.json();
      setScanResult(data);
      void loadExpectedVisitors();
    } catch {
      setError("Failed to allow entry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    const token = scanResult?.appointment?.referenceNumber;
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "checkout" }),
      });
      const data: ScanResult = await response.json();
      setScanResult(data);
      void loadExpectedVisitors();
    } catch {
      setError("Failed to record checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDenyEntry = async () => {
    const token = scanResult?.appointment?.referenceNumber;
    if (!token) return;
    if (!denyReason.trim()) {
      setError("Enter a reason before denying entry.");
      return;
    }
    if (!window.confirm("Deny entry for this reference number?")) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "deny_entry", reason: denyReason }),
      });
      const data: ScanResult = await response.json();
      setScanResult(data);
      void loadExpectedVisitors();
    } catch {
      setError("Failed to deny entry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-500">Loading...</div>;
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm w-full max-w-sm">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-14 w-auto mx-auto mb-5" />
          <h1 className="text-lg font-bold text-gray-900 text-center">Gate Entry Login</h1>
          <p className="text-sm text-gray-500 text-center mt-1 mb-5">Sign in to verify visitor appointments.</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <label htmlFor="entry-employee-id" className="label">Employee ID</label>
            <input id="entry-employee-id" type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value.toUpperCase())} className="input w-full" autoComplete="username" required />
            <label htmlFor="entry-password" className="label">Password</label>
            <input id="entry-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" autoComplete="current-password" required />
            {authError && <p className="text-red-700 text-sm">{authError}</p>}
            <button type="submit" disabled={authLoading} className="btn-primary w-full disabled:opacity-50">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 py-3 px-4 flex-shrink-0 overflow-hidden">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-14 sm:h-16 w-auto" />
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Sign Out</button>
        </div>
      </header>

      <main className="flex items-start justify-center p-4 pt-8 flex-1">
        <div className="max-w-6xl w-full space-y-4">
          {scanResult && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
            <div className={`w-full max-w-lg rounded-xl p-5 text-center animate-fade-in border ${scanResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${scanResult.success ? "bg-green-100" : "bg-red-100"}`}>
                {scanResult.success ? (
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h2 className={`text-2xl font-bold mb-1 ${scanResult.success ? "text-green-800" : "text-red-800"}`}>
                {scanResult.success ? (scanResult.reason === "preview" ? "Confirm Entry" : scanResult.reason === "checked_out" ? "Checkout Recorded" : "Entry Approved") : "Entry Denied"}
              </h2>
              <p className={`text-sm mb-4 ${scanResult.success ? "text-green-700" : "text-red-700"}`}>{scanResult.message}</p>
              {scanResult.reason && <p className="text-xs uppercase tracking-wide text-gray-500 mb-4">Result: {scanResult.reason.replace(/_/g, " ")}</p>}

              {scanResult.appointment && (
                <div className="bg-white rounded-xl p-4 text-left space-y-3 mb-4 border border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500 text-xs">Visitor</span><p className="font-medium text-gray-900">{scanResult.appointment.fullName}</p></div>
                    <div><span className="text-gray-500 text-xs">Visitor Category</span><p className="font-medium text-gray-900 capitalize">{scanResult.appointment.visitorCategory.replace(/_/g, " ")}</p></div>
                    <div><span className="text-gray-500 text-xs">Email</span><p className="font-medium text-gray-900 break-all">{scanResult.appointment.email}</p></div>
                    <div><span className="text-gray-500 text-xs">Phone</span><p className="font-medium text-gray-900">{scanResult.appointment.phone}</p></div>
                    <div><span className="text-gray-500 text-xs">Office</span><p className="font-medium text-gray-900">{scanResult.appointment.office}</p></div>
                    <div><span className="text-gray-500 text-xs">Person to Meet</span><p className="font-medium text-gray-900">{scanResult.appointment.personToMeet || "—"}</p></div>
                    <div><span className="text-gray-500 text-xs">Date</span><p className="font-medium text-gray-900">{new Date(scanResult.appointment.date).toLocaleDateString()}</p></div>
                    <div><span className="text-gray-500 text-xs">Time</span><p className="font-medium text-gray-900">{formatTimeSlot(scanResult.appointment.timeSlot)} ({scanResult.appointment.duration}m)</p></div>
                  </div>
                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <div><span className="text-gray-500 text-xs">Purpose of Visit</span><p className="mt-1 text-sm font-medium text-gray-900">{scanResult.appointment.purposeOfVisit || "—"}</p></div>
                    <div><span className="text-gray-500 text-xs">Reference Number</span><p className="mt-1 text-sm font-bold tracking-wider text-gray-900">{scanResult.appointment.referenceNumber}</p></div>
                  </div>
                  {scanResult.scannedAt && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs text-green-700">Entry recorded at {new Date(scanResult.scannedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                  )}
                  {scanResult.checkedOutAt && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                      Checkout recorded at {new Date(scanResult.checkedOutAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-gray-500 text-xs">Valid ID to Present</span>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{scanResult.appointment.validId || "—"}</p>
                  </div>

                  {scanResult.reason === "preview" && scanResult.appointment.status === "approved" && (
                    <div className="border-t border-gray-100 pt-3 space-y-3">
                      <button onClick={handleAllowEntry} disabled={loading} className="w-full py-3 rounded-lg font-medium bg-primary text-white hover:bg-primary-light disabled:opacity-50">
                        {loading ? "Allowing entry..." : "Allow Entry"}
                      </button>
                      <textarea value={denyReason} onChange={(e) => setDenyReason(e.target.value)} maxLength={500} rows={2} placeholder="Reason for denying entry" className="input w-full resize-none" />
                      <button onClick={handleDenyEntry} disabled={loading || !denyReason.trim()} className="w-full py-3 rounded-lg font-medium border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
                        {loading ? "Denying entry..." : "Deny Entry"}
                      </button>
                    </div>
                  )}

                  {scanResult.appointment && scanResult.appointment.status === "completed" && !scanResult.appointment.checkedOutAt && (
                    <button onClick={handleCheckout} disabled={loading} className="w-full py-3 mb-3 rounded-lg font-medium border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                      {loading ? "Recording checkout..." : "Record Visitor Checkout"}
                    </button>
                  )}
                </div>
              )}

              <button onClick={reset} className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${scanResult.success ? "bg-primary text-white hover:bg-primary-light" : "bg-error text-white hover:bg-red-700"}`}>
                Verify Another
              </button>
            </div>
            </div>
          )}

          {!scanResult && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start animate-fade-in">
              <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-900">Today&apos;s expected visitors</h2>
                  <button type="button" onClick={loadExpectedVisitors} className="text-xs text-primary hover:underline">Refresh</button>
                </div>
                {dashboardLoading ? <p className="text-sm text-gray-500">Loading today&apos;s visitors...</p> : expectedVisitors.length === 0 ? <p className="text-sm text-gray-500">No approved visitors expected today.</p> : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {expectedVisitors.map((visitor) => (
                      <button type="button" key={visitor.id} onClick={() => setReference(visitor.referenceNumber)} className="w-full text-left border border-gray-100 rounded-lg p-3 hover:border-primary/40 hover:bg-gray-50">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-sm text-gray-900">{visitor.fullName}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${visitor.status === "completed" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>{visitor.status === "completed" ? "Checked in" : "Expected"}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{visitor.office} · {formatTimeSlot(visitor.timeSlot)}</div>
                        <div className="text-xs font-semibold tracking-wider text-gray-700 mt-1">Reference: {visitor.referenceNumber}</div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h1 className="text-lg font-bold text-gray-900 text-center">Gate Entry</h1>
              <p className="text-sm text-gray-500 text-center mt-1 mb-5">Enter the reference number to verify the visitor&apos;s appointment and allow entry.</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  placeholder="Enter reference number"
                  autoFocus
                  maxLength={12}
                  disabled={loading}
                  className="input w-full text-center text-xl font-bold tracking-[0.3em] uppercase"
                />
                <button type="submit" disabled={loading || !reference.trim()}
                  className="btn-primary w-full disabled:opacity-30 disabled:cursor-not-allowed">
                  {loading ? "Verifying..." : "Verify Reference Number"}
                </button>
              </form>
              {error && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}