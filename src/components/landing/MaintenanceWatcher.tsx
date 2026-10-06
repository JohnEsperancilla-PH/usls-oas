"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 30_000;

export default function MaintenanceWatcher() {
  const router = useRouter();
  const knownActive = useRef(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/maintenance", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.active && !knownActive.current) {
          knownActive.current = true;
          router.refresh();
        }
      } catch {
        /* status polling is best-effort */
      }
    };

    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
