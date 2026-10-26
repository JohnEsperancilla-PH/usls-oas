"use client";

import { useEffect, useState } from "react";

export type StatusMessageValue = { type: "success" | "error"; text: string };

const SUCCESS_TIMEOUT_MS = 5000;

// Page-level feedback: success messages clear themselves, errors stay until replaced or dismissed.
export function useStatusMessage() {
  const [message, setMessage] = useState<StatusMessageValue | null>(null);

  useEffect(() => {
    if (message?.type !== "success") return;
    const timer = setTimeout(() => setMessage((current) => (current === message ? null : current)), SUCCESS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return [message, setMessage] as const;
}

export function StatusMessage({ message, onRetry, onDismiss, className = "" }: { message: StatusMessageValue; onRetry?: () => void; onDismiss?: () => void; className?: string }) {
  const isSuccess = message.type === "success";
  return (
    <div role={isSuccess ? "status" : "alert"}
      className={`p-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in ${isSuccess ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"} ${className}`}>
      {isSuccess
        ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      <span className="flex-1">{message.text}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-xs font-semibold underline underline-offset-2 hover:no-underline flex-shrink-0">Try again</button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="p-0.5 rounded opacity-60 hover:opacity-100 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}
