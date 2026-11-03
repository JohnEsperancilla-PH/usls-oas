"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/admin/ModalShell";
import type { SystemAlert } from "@/lib/system-alert";

const DISMISSED_KEY = "oasys-dismissed-system-alert";

function readDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

// Shown once per browser for each version of the popup's text.
export function SystemAlertModal({ alert }: { alert: SystemAlert }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // localStorage only exists in the browser, so this can't be decided during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(readDismissedVersion() !== alert.version);
  }, [alert.version]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISSED_KEY, alert.version);
    } catch {}
  };

  return (
    <ModalShell open={open} title="System Update" maxWidthClass="max-w-lg" onClose={dismiss}
      footer={<button type="button" onClick={dismiss} className="btn-primary w-full">Got it</button>}>
      <h3 className="text-sm font-semibold text-gray-900 break-words">{alert.headline}</h3>
      <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-line break-words">{alert.message}</p>
    </ModalShell>
  );
}

// For signed-in staff pages, which are client components.
export function SystemAlertLoader({ audience }: { audience: "admin" | "gate" }) {
  const [alert, setAlert] = useState<SystemAlert | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/system-alert?audience=${audience}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setAlert(data?.alert ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [audience]);

  return alert ? <SystemAlertModal alert={alert} /> : null;
}
