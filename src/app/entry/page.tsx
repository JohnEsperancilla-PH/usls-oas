"use client";

import { useState } from "react";
import { formatTimeSlot } from "@/lib/time";

interface ScanResult {
  success: boolean;
  message: string;
  scannedAt?: string;
  appointment?: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    office: string;
    date: string;
    timeSlot: string;
    duration: number;
    validId: string;
  };
}

export default function EntryPage() {
  const [reference, setReference] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 py-3 px-4 flex-shrink-0 overflow-hidden">
        <div className="max-w-lg mx-auto flex items-center justify-center">
          <img src="/usls-oas.png" alt="USLS OAS" className="h-14 sm:h-16 w-auto" />
        </div>
      </header>

      <main className="flex items-start justify-center p-4 pt-8 flex-1">
        <div className="max-w-lg w-full space-y-4">
          {scanResult && (
            <div className={`rounded-xl p-6 text-center animate-fade-in border ${scanResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${scanResult.success ? "bg-green-100" : "bg-red-100"}`}>
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
              <h2 className={`text-2xl font-bold mb-2 ${scanResult.success ? "text-green-800" : "text-red-800"}`}>
                {scanResult.success ? "Entry Approved" : "Entry Denied"}
              </h2>
              <p className={`text-sm mb-6 ${scanResult.success ? "text-green-700" : "text-red-700"}`}>{scanResult.message}</p>

              {scanResult.success && scanResult.appointment && (
                <div className="bg-white rounded-xl p-5 text-left space-y-4 mb-6 border border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500 text-xs">Visitor</span><p className="font-medium text-gray-900">{scanResult.appointment.fullName}</p></div>
                    <div><span className="text-gray-500 text-xs">Office</span><p className="font-medium text-gray-900">{scanResult.appointment.office}</p></div>
                    <div><span className="text-gray-500 text-xs">Date</span><p className="font-medium text-gray-900">{new Date(scanResult.appointment.date).toLocaleDateString()}</p></div>
                    <div><span className="text-gray-500 text-xs">Time</span><p className="font-medium text-gray-900">{formatTimeSlot(scanResult.appointment.timeSlot)} ({scanResult.appointment.duration}m)</p></div>
                  </div>
                  {scanResult.scannedAt && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs text-green-700">Entry recorded at {new Date(scanResult.scannedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-gray-500 text-xs">Valid ID to Present</span>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{scanResult.appointment.validId || "—"}</p>
                  </div>
                </div>
              )}

              <button onClick={reset} className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${scanResult.success ? "bg-primary text-white hover:bg-primary-light" : "bg-error text-white hover:bg-red-700"}`}>
                Verify Another
              </button>
            </div>
          )}

          {!scanResult && (
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm animate-fade-in">
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
}