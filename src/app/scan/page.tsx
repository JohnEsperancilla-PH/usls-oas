"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface ScanResult {
  success: boolean;
  message: string;
  appointment?: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    office: string;
    date: string;
    timeSlot: string;
    duration: number;
    idImageUrl: string;
  };
}

export default function ScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [scanCount, setScanCount] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner";

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  const handleScanResult = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data: ScanResult = await response.json();
      setScanResult(data);
      setScanCount((c) => c + 1);
    } catch {
      setError("Failed to verify QR code. Please try again.");
    }
  }, []);

  const startScanner = async () => {
    setError(null);
    setScanResult(null);
    try {
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        async (decodedText) => { await handleScanResult(decodedText); stopScanner(); },
        () => {}
      );
      setIsScanning(true);
    } catch {
      setError("Camera not available. Use manual entry below.");
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) await handleScanResult(manualToken.trim());
  };

  const resetScanner = () => { setScanResult(null); setError(null); setManualToken(""); };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { return () => { stopScanner(); }; }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 py-3 px-4 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold">Gate Verification</h1>
              <p className="text-xs text-gray-500">USLS OAS</p>
            </div>
          </div>
          {scanCount > 0 && (
            <div className="text-xs text-gray-500 flex items-center gap-1.5">
              <span className="pulse-dot" />
              {scanCount} scanned
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-4">
          {/* Scanner Result */}
          {scanResult && (
            <div className={`rounded-2xl p-6 text-center animate-fade-in ${scanResult.success ? "bg-green-900/50 border border-green-800" : "bg-red-900/50 border border-red-800"}`}>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${scanResult.success ? "bg-green-600" : "bg-red-600"}`}>
                {scanResult.success ? (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${scanResult.success ? "text-green-200" : "text-red-200"}`}>
                {scanResult.success ? "Entry Approved" : "Entry Denied"}
              </h2>
              <p className={`text-sm mb-6 ${scanResult.success ? "text-green-300/70" : "text-red-300/70"}`}>{scanResult.message}</p>

              {scanResult.success && scanResult.appointment && (
                <div className="bg-gray-900/80 rounded-xl p-5 text-left space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500 text-xs">Visitor</span><p className="font-medium">{scanResult.appointment.fullName}</p></div>
                    <div><span className="text-gray-500 text-xs">Office</span><p className="font-medium">{scanResult.appointment.office}</p></div>
                    <div><span className="text-gray-500 text-xs">Date</span><p className="font-medium">{new Date(scanResult.appointment.date).toLocaleDateString()}</p></div>
                    <div><span className="text-gray-500 text-xs">Time</span><p className="font-medium">{scanResult.appointment.timeSlot} ({scanResult.appointment.duration}m)</p></div>
                  </div>
                  <div className="border-t border-gray-700/50 pt-3">
                    <span className="text-gray-500 text-xs">ID for Verification</span>
                    <div className="mt-2">
                      <img src={scanResult.appointment.idImageUrl} alt="Visitor ID" className="w-32 h-auto rounded-lg border border-gray-700" />
                    </div>
                  </div>
                </div>
              )}

              <button onClick={resetScanner} className={`px-6 py-3 rounded-xl font-medium transition-colors ${scanResult.success ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
                Scan Next
              </button>
            </div>
          )}

          {/* Scanner */}
          {!scanResult && (
            <>
              {error && (
                <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-center animate-fade-in">
                  <p className="text-red-300 text-sm mb-3">{error}</p>
                  <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300 underline">Dismiss</button>
                </div>
              )}

              <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
                <div className="relative">
                  <div id={scannerContainerId} className="w-full aspect-square bg-gray-800" />
                  {!isScanning && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90">
                      <div className="text-center">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        <p className="text-gray-500 text-sm">Camera preview will appear here</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 flex justify-center">
                  {!isScanning ? (
                    <button onClick={startScanner} className="bg-primary hover:bg-primary-light px-8 py-3 rounded-xl font-medium transition-colors w-full">
                      Start Camera
                    </button>
                  ) : (
                    <button onClick={stopScanner} className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-xl font-medium transition-colors w-full">
                      Stop Camera
                    </button>
                  )}
                </div>
              </div>

              {/* Manual Entry */}
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <p className="text-center text-gray-500 text-xs mb-3">Or enter token manually</p>
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste QR token..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-600"
                  />
                  <button type="submit" disabled={!manualToken.trim()}
                    className="bg-primary hover:bg-primary-light px-6 py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    Verify
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
