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
    visitorCount: number;
    visitors: { fullName: string; validId: string; isBooker: boolean }[];
    vehicleCount: number;
    vehicles: { plateNumber: string; makeModel: string }[];
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
  visitorCount: number;
  visitors: { fullName: string; validId: string; isBooker: boolean }[];
  vehicleCount: number;
  vehicles: { plateNumber: string; makeModel: string }[];
  checkedOutAt?: string | null;
}

export default function EntryPage() {
  const supabase = createClient();
  const [authenticated, setAuthenticated] = useState(false);
  const [officerName, setOfficerName] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [showDenyReason, setShowDenyReason] = useState(false);
  const [expectedVisitors, setExpectedVisitors] = useState<ExpectedVisitor[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

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
      .then((data: { authenticated?: boolean; officerName?: string }) => {
        setAuthenticated(data.authenticated === true);
        setOfficerName(data.officerName || "");
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
      const data: { authenticated?: boolean; message?: string; session?: Session; officerName?: string } = await response.json();
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
      setOfficerName(data.officerName || employeeId);
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
    setShowDenyReason(false);
    void loadExpectedVisitors();
  };

  const currentDateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(currentTime);
  const currentTimeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(currentTime);
  const getInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

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
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-14 sm:h-16 w-auto" />
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-gray-800">Gate Officer Dashboard</p>
              <p className="text-xs text-gray-500">Logged in as <span className="font-medium text-gray-700">{officerName || employeeId}</span> · {currentDateLabel} · {currentTimeLabel}</p>
            </div>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="flex items-start justify-center p-4 pt-6 sm:pt-8 flex-1">
        <div className="max-w-6xl w-full space-y-4">
          <div className="sm:hidden">
            <p className="text-lg font-bold text-gray-900">Gate Officer Dashboard</p>
            <p className="text-xs text-gray-500 mt-1">Logged in as <span className="font-medium text-gray-700">{officerName || employeeId}</span> · {currentDateLabel} · {currentTimeLabel}</p>
          </div>
          {scanResult && (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/40 p-4 sm:items-center">
            <div className={`relative w-full max-w-lg lg:max-w-6xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl p-4 text-center animate-modal-in border ${scanResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <button type="button" onClick={reset} aria-label="Close confirmation" className="absolute top-3 right-3 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1 ${scanResult.success ? "bg-green-100" : "bg-red-100"}`}>
                {scanResult.success ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h2 className={`text-xl font-bold mb-1 ${scanResult.success ? "text-green-800" : "text-red-800"}`}>
                {scanResult.success ? (scanResult.reason === "preview" ? "Confirm Entry" : scanResult.reason === "checked_out" ? "Checkout Recorded" : "Entry Approved") : "Entry Denied"}
              </h2>
              <p className={`text-sm mb-2 ${scanResult.success ? "text-green-700" : "text-red-700"}`}>{scanResult.message}</p>
              {scanResult.reason && <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-3">Result: {scanResult.reason.replace(/_/g, " ")}</p>}

              {scanResult.appointment && (
                <div className="bg-white rounded-xl p-3 text-left space-y-2 mb-3 border border-gray-200 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-3 lg:space-y-0 lg:items-start">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:col-span-2">
                    <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100 pb-1">Visitor and appointment details</div>
                    <div><span className="text-gray-500 text-xs">Visitor</span><p className="font-medium text-gray-900">{scanResult.appointment.fullName}</p></div>
                    <div><span className="text-gray-500 text-xs">Visitor Category</span><p className="font-medium text-gray-900 capitalize">{scanResult.appointment.visitorCategory.replace(/_/g, " ")}</p></div>
                    <div><span className="text-gray-500 text-xs">Email</span><p className="font-medium text-gray-900 break-all">{scanResult.appointment.email}</p></div>
                    <div><span className="text-gray-500 text-xs">Phone</span><p className="font-medium text-gray-900">{scanResult.appointment.phone}</p></div>
                    <div><span className="text-gray-500 text-xs">Number of Visitors</span><p className="font-medium text-gray-900">{scanResult.appointment.visitorCount}</p></div>
                    <div><span className="text-gray-500 text-xs">Office</span><p className="font-medium text-gray-900">{scanResult.appointment.office}</p></div>
                    <div><span className="text-gray-500 text-xs">Person to Meet</span><p className="font-medium text-gray-900">{scanResult.appointment.personToMeet || "—"}</p></div>
                    <div><span className="text-gray-500 text-xs">Date</span><p className="font-medium text-gray-900">{new Date(scanResult.appointment.date).toLocaleDateString()}</p></div>
                    <div><span className="text-gray-500 text-xs">Time</span><p className="font-medium text-gray-900">{formatTimeSlot(scanResult.appointment.timeSlot)} ({scanResult.appointment.duration}m)</p></div>
                  </div>
                  <div className="border-t border-gray-100 pt-2 space-y-2 lg:col-span-2">
                    <div><span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Visit details</span><p className="mt-1 text-sm font-semibold text-gray-900">{scanResult.appointment.purposeOfVisit || "—"}</p></div>
                    <div><span className="text-gray-500 text-[11px]">Reference Number</span><p className="mt-0.5 text-sm font-bold tracking-wider text-gray-900">{scanResult.appointment.referenceNumber}</p></div>
                  </div>
                  {scanResult.scannedAt && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2 lg:col-span-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs text-green-700">Entry recorded at {new Date(scanResult.scannedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                  )}
                  {scanResult.checkedOutAt && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 lg:col-span-2">
                      Checkout recorded at {new Date(scanResult.checkedOutAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-2 lg:col-span-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Identity requirement</span>
                    <p className="mt-1 text-sm font-semibold text-gray-900">Valid ID to Present: {scanResult.appointment.validId || "—"}</p>
                  </div>
                  {scanResult.appointment.vehicles.length > 0 && (
                    <div className="border-t border-gray-100 pt-2 lg:col-span-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Registered Vehicles ({scanResult.appointment.vehicleCount})</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {scanResult.appointment.vehicles.map((vehicle, index) => (
                          <span key={`${vehicle.plateNumber}-${index}`} className="px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs font-mono font-medium text-blue-800">
                            {vehicle.plateNumber}{vehicle.makeModel ? ` · ${vehicle.makeModel}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {scanResult.appointment.visitors.length > 1 && (
                    <div className="border-t border-gray-100 pt-2 lg:col-start-1 lg:col-span-1 lg:border-l lg:border-r lg:px-5 lg:h-full">
                      <span className="text-gray-500 text-[11px]">Visitors entering together</span>
                      <div className="mt-1 space-y-1">
                        {scanResult.appointment.visitors.map((visitor, index) => (
                          <div key={`${visitor.fullName}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium text-gray-900">{visitor.fullName}{visitor.isBooker ? " (booker)" : ""}</span>
                            <span className="text-gray-500 text-right">{visitor.validId}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-amber-700">All visitors must enter together. This reference number belongs to the booking person.</p>
                    </div>
                  )}
                  {scanResult.reason === "preview" && scanResult.appointment.status === "approved" && (
                    <div className="border-t border-gray-100 pt-2 space-y-2 lg:col-start-2 lg:col-span-1">
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleAllowEntry} disabled={loading} className="w-full py-2.5 rounded-lg font-medium bg-primary text-white hover:bg-primary-light disabled:opacity-50">
                        {loading ? "Allowing entry..." : "Allow Entry"}
                        </button>
                        {!showDenyReason ? (
                          <button type="button" onClick={() => setShowDenyReason(true)} disabled={loading} className="w-full py-2.5 rounded-lg font-medium border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
                            Deny Entry
                          </button>
                        ) : (
                          <button onClick={handleDenyEntry} disabled={loading || !denyReason.trim()} className="w-full py-2.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                            {loading ? "Denying..." : "Confirm Denial"}
                          </button>
                        )}
                      </div>
                      {showDenyReason && (
                        <textarea value={denyReason} onChange={(e) => setDenyReason(e.target.value)} maxLength={500} rows={2} placeholder="Reason for denying entry" className="input w-full resize-none" autoFocus />
                      )}
                    </div>
                  )}

                  {scanResult.appointment && scanResult.appointment.status === "completed" && !scanResult.appointment.checkedOutAt && (
                    <div className="lg:col-start-2 lg:col-span-1">
                      <p className="text-xs text-gray-400 mb-2">Use checkout only when this reference was previously checked in.</p>
                      <button onClick={handleCheckout} disabled={loading} className="w-full py-3 rounded-lg font-medium border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                        {loading ? "Recording checkout..." : "Record Visitor Checkout"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button onClick={reset} className="w-full mt-4 py-2.5 rounded-lg font-medium bg-primary text-white hover:bg-primary-light transition-all duration-200">
                Verify Another
              </button>
            </div>
            </div>
          )}

          {!scanResult && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] items-stretch animate-fade-in lg:min-h-[calc(100vh-12rem)]">
              <section className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 shadow-sm flex min-h-[420px] flex-col">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Browse</p>
                    <h2 className="font-bold text-gray-900 mt-1">Today&apos;s expected visitors</h2>
                  </div>
                  <button type="button" onClick={loadExpectedVisitors} className="text-xs text-primary hover:underline">Refresh</button>
                </div>
                {dashboardLoading ? <p className="text-sm text-gray-500">Loading today&apos;s visitors...</p> : expectedVisitors.length === 0 ? <p className="text-sm text-gray-500">No approved visitors expected today.</p> : (
                  <div className="relative flex-1 min-h-0">
                  <div className="h-full space-y-1.5 overflow-y-auto pr-1 pb-8">
                    {expectedVisitors.map((visitor) => (
                      <button type="button" key={visitor.id} onClick={() => setReference(visitor.referenceNumber)} className="w-full text-left border-b border-gray-100 px-2 py-3.5 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">{getInitials(visitor.fullName)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-sm text-gray-900 truncate">{visitor.fullName}</span>
                              <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${visitor.status === "completed" ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>{visitor.status === "completed" ? "Checked in" : "Expected"}</span>
                            </div>
                            <div className="text-sm font-medium text-gray-700 mt-1">{formatTimeSlot(visitor.timeSlot)} <span className="text-gray-400 font-normal">· {visitor.office}</span></div>
                          </div>
                        </div>
                        {visitor.visitorCount > 1 && <div className="text-xs text-primary mt-1">{visitor.visitorCount} visitors entering together</div>}
                        {visitor.vehicleCount > 0 && <div className="text-xs text-blue-600 font-mono mt-0.5">{visitor.vehicles.map((v) => v.plateNumber).join(", ")}</div>}
                        <div className="text-[11px] font-mono text-gray-400 mt-1.5">Reference {visitor.referenceNumber}</div>
                      </button>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
                  </div>
                )}
              </section>

              <section className="bg-white rounded-xl p-5 sm:p-6 border border-primary/20 shadow-md flex min-h-[420px] flex-col">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Action</p>
                <h1 className="text-xl font-bold text-gray-900 mt-1">Gate Entry</h1>
                <p className="text-sm text-gray-500 mt-1">Verify a visitor&apos;s reference number to begin entry.</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  placeholder="Enter reference number"
                  autoFocus
                  maxLength={12}
                  disabled={loading}
                  className="input w-full text-center text-xl font-medium tracking-normal"
                />
                <button type="submit" disabled={loading || !reference.trim()}
                  className="btn-primary w-full bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Verifying..." : "Verify Reference Number"}
                </button>
              </form>
              {error && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              <div className="mt-auto pt-8 border-t border-gray-100">
                <p className="text-xs text-gray-400 leading-relaxed">Use the visitor&apos;s reference number from their approval email. Select a visitor from the list to fill it automatically.</p>
              </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}