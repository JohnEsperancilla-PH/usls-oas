"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

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
    idImageUrl: string;
  };
}

const SCANNER_ID = "qr-reader";

export default function ScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);
  const processingRef = useRef(false);

  const getQrBox = (viewfinderWidth: number, viewfinderHeight: number) => {
    const minDim = Math.min(viewfinderWidth, viewfinderHeight);
    const size = Math.floor(minDim * 0.7);
    return { width: size, height: size };
  };

  const startScanner = async () => {
    setError(null);
    setScanResult(null);
    setCooldown(0);
    processingRef.current = false;
    if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }

    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }

    const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false, useBarCodeDetectorIfSupported: true });
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 30,
          qrbox: getQrBox,
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (processingRef.current) return;
          processingRef.current = true;
          handleScanResult(decodedText);
        },
        () => {},
      );
      setIsScanning(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Camera error: ${msg}`);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanResult = async (token: string) => {
    await stopScanner();
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data: ScanResult = await response.json();
      setScanResult(data);
      setCooldown(5);
    } catch {
      setError("Failed to verify QR code. Please try again.");
      startScanner();
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      await stopScanner();
      await handleScanResult(manualToken.trim());
      setManualToken("");
    }
  };

  useEffect(() => {
    startScanner();
    return () => { stopScanner(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); };
    }
    if (cooldown === 0 && scanResult) {
      startScanner();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown, scanResult]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 py-3 px-4 flex-shrink-0 overflow-hidden">
        <div className="max-w-lg mx-auto flex items-center justify-center">
          <img src="/usls-oas.png" alt="USLS OAS" className="h-14 sm:h-16 w-auto" />
        </div>
      </header>

      <main className="flex items-start justify-center p-4 pt-8">
        <div className="max-w-lg w-full space-y-4">
          <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="relative">
              <div
                id={SCANNER_ID}
                className="w-full aspect-square"
                style={{ display: scanResult ? "none" : undefined }}
              />
              {scanResult && (
                <div className="w-full aspect-square flex items-center justify-center bg-gray-100">
                  <p className="text-gray-400 text-sm">Scanning paused</p>
                </div>
              )}
            </div>
            {!scanResult && isScanning && (
              <div className="p-3 text-center border-t border-gray-100">
                <div className="flex items-center justify-center gap-2">
                  <span className="pulse-dot" />
                  <span className="text-xs text-primary font-medium">Camera active — point at QR code</span>
                </div>
              </div>
            )}
          </div>

          {error && !scanResult && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center animate-fade-in">
              <p className="text-red-700 text-sm mb-3">{error}</p>
              <button onClick={() => setError(null)} className="text-xs text-red-500 hover:text-red-700 underline">Dismiss</button>
            </div>
          )}

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
                    <div><span className="text-gray-500 text-xs">Time</span><p className="font-medium text-gray-900">{scanResult.appointment.timeSlot} ({scanResult.appointment.duration}m)</p></div>
                  </div>
                  {scanResult.scannedAt && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs text-green-700">Entry recorded at {new Date(scanResult.scannedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-gray-500 text-xs">ID for Verification</span>
                    <div className="mt-2">
                      <img src={scanResult.appointment.idImageUrl} alt="Visitor ID" className="w-32 h-auto rounded-lg border border-gray-200" />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {cooldown > 0 && (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Ready to scan in {cooldown}s
                  </div>
                )}
                <button onClick={() => startScanner()} className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${scanResult.success ? "bg-primary text-white hover:bg-primary-light" : "bg-error text-white hover:bg-red-700"}`}>
                  Scan Next
                </button>
              </div>
            </div>
          )}

          {!scanResult && (
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <button onClick={() => startScanner()}
                className="w-full mb-3 py-2.5 px-4 rounded-lg border-2 border-dashed border-primary/40 text-sm font-medium text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                Start Camera / Scan QR Code
              </button>
              <p className="text-center text-gray-400 text-xs mb-3">Or enter token manually</p>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste QR token..."
                  className="input flex-1"
                />
                <button type="submit" disabled={!manualToken.trim()}
                  className="btn-primary btn-sm disabled:opacity-30 disabled:cursor-not-allowed">
                  Verify
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
