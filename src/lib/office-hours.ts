// Operating hours are stored as text like "8:00 AM - 5:00 PM"; forms edit them as two 24-hour times.
export function parseHours(value: string): { start: string; end: string } | null {
  const match = value.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i);
  if (!match) return null;
  const to24 = (h: string, m: string | undefined, period: string) => {
    let hour = parseInt(h, 10) % 12;
    if (period.toUpperCase() === "PM") hour += 12;
    return `${String(hour).padStart(2, "0")}:${m || "00"}`;
  };
  return { start: to24(match[1], match[2], match[3]), end: to24(match[4], match[5], match[6]) };
}

export function formatHours(start: string, end: string): string {
  const to12 = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  return start && end ? `${to12(start)} - ${to12(end)}` : "";
}
