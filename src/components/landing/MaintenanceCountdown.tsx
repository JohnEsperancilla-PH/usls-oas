"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TICK_MS = 30_000;

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

export default function MaintenanceCountdown({
  endsAt,
  initialRemaining,
}: {
  endsAt: string;
  initialRemaining: number;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(initialRemaining);
  const refreshed = useRef(false);

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(next);
      if (next === 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    };

    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [endsAt, router]);

  return <span className="font-semibold text-primary">{formatRemaining(remaining)}</span>;
}
