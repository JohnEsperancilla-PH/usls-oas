// Aggregations for /admin/analytics. Pure functions over appointment rows so the route stays thin.
// Dates are Asia/Manila "YYYY-MM-DD"; timestamps are ISO strings.

export interface AnalyticsAppointment {
  id: string;
  status: string;
  date: string;
  time_slot: string | null;
  duration: number;
  office_id: string;
  visitor_category: string | null;
  visitor_count: number | null;
  vehicle_count: number | null;
  is_invitation: boolean | null;
  scanned_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  person_to_meet: string | null;
  valid_id: string | null;
}

export interface DecisionLog {
  appointment_id: string;
  action: string;
  created_at: string;
}

export interface Bucket {
  label: string;
  value: number;
}

export interface OfficeRow {
  officeId: string;
  officeName: string;
  requests: number;
  visitors: number;
  approvalRate: number | null;
  showUpRate: number | null;
  checkIns: number;
  avgMinutesOnCampus: number | null;
}

export interface AnalyticsResult {
  range: { from: string; to: string };
  kpis: {
    requests: number;
    visitorsExpected: number;
    vehicles: number;
    invitations: number;
    publicBookings: number;
    approvalRate: number | null;
    showUpRate: number | null;
    checkIns: number;
    checkOuts: number;
    missingCheckouts: number;
    avgMinutesOnCampus: number | null;
    medianMinutesOnCampus: number | null;
    medianResponseHours: number | null;
    pending: number;
  };
  daily: { date: string; scheduled: number; checkIns: number }[];
  statuses: Bucket[];
  funnel: Bucket[];
  heatmap: { weekdays: string[]; slots: string[]; counts: number[][] };
  checkInsByHour: Bucket[];
  punctuality: Bucket[];
  timeOnCampus: Bucket[];
  responseTime: Bucket[];
  leadTime: Bucket[];
  categories: Bucket[];
  groupSizes: Bucket[];
  durations: Bucket[];
  weekdays: Bucket[];
  offices: OfficeRow[];
  topPeopleToMeet: Bucket[];
  topValidIds: Bucket[];
}

const STATUS_ORDER = ["pending", "approved", "postponed", "completed", "declined", "entry_denied", "expired"];
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  postponed: "Postponed",
  completed: "Checked in",
  declined: "Declined",
  entry_denied: "Entry denied",
  expired: "Expired (no-show)",
};
const CATEGORY_LABELS: Record<string, string> = {
  external: "External visitor",
  parents: "Parent / guardian",
  alumni: "Alumni",
  vendor: "Vendor / supplier",
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
// Approved at some point: these statuses only happen after approval.
const APPROVED_STATUSES = new Set(["approved", "completed", "expired", "entry_denied"]);
const DECIDED_STATUSES = new Set([...APPROVED_STATUSES, "declined"]);

function manilaParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: parseInt(get("hour"), 10) % 24 };
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

function bucketize(values: number[], edges: { label: string; max: number }[]): Bucket[] {
  const buckets = edges.map((e) => ({ label: e.label, value: 0 }));
  for (const v of values) {
    const index = edges.findIndex((e) => v < e.max);
    buckets[index === -1 ? edges.length - 1 : index].value++;
  }
  return buckets;
}

function topCounts(values: (string | null)[], limit: number): Bucket[] {
  const counts = new Map<string, { label: string; value: number }>();
  for (const raw of values) {
    const label = (raw || "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const entry = counts.get(key) || { label, value: 0 };
    entry.value++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}

function scheduledAt(a: AnalyticsAppointment): number | null {
  return a.time_slot ? Date.parse(`${a.date}T${a.time_slot}:00+08:00`) : null;
}

function minutesOnCampus(a: AnalyticsAppointment): number | null {
  if (!a.scanned_at || !a.checked_out_at) return null;
  const minutes = (Date.parse(a.checked_out_at) - Date.parse(a.scanned_at)) / 60_000;
  return minutes >= 0 ? minutes : null;
}

export function computeAnalytics(
  appointments: AnalyticsAppointment[],
  decisions: DecisionLog[],
  officeNames: Record<string, string>,
  range: { from: string; to: string },
  today: string,
): AnalyticsResult {
  const scanned = appointments.filter((a) => a.scanned_at);
  const campusMinutes = appointments.map(minutesOnCampus).filter((m): m is number => m !== null);

  // Show-up: approved visits whose day has passed, split into arrived vs not.
  const showUp = (rows: AnalyticsAppointment[]) => {
    const due = rows.filter((a) => APPROVED_STATUSES.has(a.status) && a.date < today);
    const arrived = due.filter((a) => a.status === "completed" || a.status === "entry_denied" || a.scanned_at);
    return ratio(arrived.length, due.length);
  };
  const approval = (rows: AnalyticsAppointment[]) => {
    const decided = rows.filter((a) => DECIDED_STATUSES.has(a.status) && !a.is_invitation);
    return ratio(decided.filter((a) => APPROVED_STATUSES.has(a.status)).length, decided.length);
  };

  // Response time: request submitted -> first approve/decline/postpone by an admin. Invitations are pre-approved.
  const firstDecision = new Map<string, number>();
  for (const d of decisions) {
    const t = Date.parse(d.created_at);
    const prev = firstDecision.get(d.appointment_id);
    if (prev === undefined || t < prev) firstDecision.set(d.appointment_id, t);
  }
  const responseHours = appointments
    .filter((a) => !a.is_invitation && firstDecision.has(a.id))
    .map((a) => (firstDecision.get(a.id)! - Date.parse(a.created_at)) / 3_600_000)
    .filter((h) => h >= 0);

  const dates = eachDate(range.from, range.to);
  const scheduledByDate = new Map<string, number>();
  const checkInsByDate = new Map<string, number>();
  for (const a of appointments) scheduledByDate.set(a.date, (scheduledByDate.get(a.date) || 0) + 1);
  for (const a of scanned) {
    const day = manilaParts(a.scanned_at!).date;
    checkInsByDate.set(day, (checkInsByDate.get(day) || 0) + 1);
  }

  const slots: string[] = [];
  for (let m = 8 * 60; m < 17 * 60; m += 30) {
    if (m >= 12 * 60 && m < 13 * 60 + 30) continue;
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  const heat = WEEKDAYS.map(() => slots.map(() => 0));
  const weekdayCounts = WEEKDAYS.map(() => 0);
  for (const a of appointments) {
    const dow = new Date(`${a.date}T00:00:00Z`).getUTCDay(); // 1 = Mon
    if (dow < 1 || dow > 5) continue;
    weekdayCounts[dow - 1]++;
    const slotIndex = a.time_slot ? slots.indexOf(a.time_slot) : -1;
    if (slotIndex !== -1) heat[dow - 1][slotIndex]++;
  }

  const hourCounts = new Map<number, number>();
  for (const a of scanned) {
    const { hour } = manilaParts(a.scanned_at!);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }
  const formatHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
  const checkInsByHour: Bucket[] = [];
  for (let h = 6; h <= 19; h++) checkInsByHour.push({ label: formatHour(h), value: hourCounts.get(h) || 0 });

  // Minutes relative to the scheduled time: negative = early.
  const arrivalOffsets = scanned
    .map((a) => { const s = scheduledAt(a); return s === null ? null : (Date.parse(a.scanned_at!) - s) / 60_000; })
    .filter((m): m is number => m !== null);

  const leadDays = appointments
    .filter((a) => !a.is_invitation)
    .map((a) => daysBetween(manilaParts(a.created_at).date, a.date))
    .filter((d) => d >= 0);

  const groupSizes = appointments.map((a) => a.visitor_count || 1);

  const officeIds = [...new Set(appointments.map((a) => a.office_id))];
  const offices: OfficeRow[] = officeIds.map((officeId) => {
    const rows = appointments.filter((a) => a.office_id === officeId);
    return {
      officeId,
      officeName: officeNames[officeId] || "Unknown office",
      requests: rows.length,
      visitors: rows.reduce((s, a) => s + (a.visitor_count || 1), 0),
      approvalRate: approval(rows),
      showUpRate: showUp(rows),
      checkIns: rows.filter((a) => a.scanned_at).length,
      avgMinutesOnCampus: average(rows.map(minutesOnCampus).filter((m): m is number => m !== null)),
    };
  }).sort((a, b) => b.requests - a.requests);

  const count = (status: string) => appointments.filter((a) => a.status === status).length;
  const approvedEver = appointments.filter((a) => APPROVED_STATUSES.has(a.status)).length;

  return {
    range,
    kpis: {
      requests: appointments.length,
      visitorsExpected: groupSizes.reduce((s, v) => s + v, 0),
      vehicles: appointments.reduce((s, a) => s + (a.vehicle_count || 0), 0),
      invitations: appointments.filter((a) => a.is_invitation).length,
      publicBookings: appointments.filter((a) => !a.is_invitation).length,
      approvalRate: approval(appointments),
      showUpRate: showUp(appointments),
      checkIns: scanned.length,
      checkOuts: appointments.filter((a) => a.checked_out_at).length,
      // Checked in on an earlier day and never checked out.
      missingCheckouts: appointments.filter((a) => a.scanned_at && !a.checked_out_at && manilaParts(a.scanned_at).date < today).length,
      avgMinutesOnCampus: average(campusMinutes),
      medianMinutesOnCampus: median(campusMinutes),
      medianResponseHours: median(responseHours),
      pending: count("pending"),
    },
    daily: dates.map((date) => ({ date, scheduled: scheduledByDate.get(date) || 0, checkIns: checkInsByDate.get(date) || 0 })),
    statuses: STATUS_ORDER.map((s) => ({ label: STATUS_LABELS[s], value: count(s) })).filter((b) => b.value > 0),
    funnel: [
      { label: "Requested", value: appointments.length },
      { label: "Approved", value: approvedEver },
      { label: "Checked in", value: scanned.length },
      { label: "Checked out", value: appointments.filter((a) => a.checked_out_at).length },
    ],
    heatmap: { weekdays: WEEKDAYS, slots, counts: heat },
    checkInsByHour,
    punctuality: bucketize(arrivalOffsets, [
      { label: "30+ min early", max: -30 },
      { label: "Up to 30 min early", max: 0 },
      { label: "Up to 15 min late", max: 15 },
      { label: "15–60 min late", max: 60 },
      { label: "60+ min late", max: Infinity },
    ]),
    timeOnCampus: bucketize(campusMinutes, [
      { label: "Under 30 min", max: 30 },
      { label: "30–60 min", max: 60 },
      { label: "1–2 hours", max: 120 },
      { label: "2–4 hours", max: 240 },
      { label: "4+ hours", max: Infinity },
    ]),
    responseTime: bucketize(responseHours, [
      { label: "Under 1 hour", max: 1 },
      { label: "1–4 hours", max: 4 },
      { label: "4–24 hours", max: 24 },
      { label: "1–3 days", max: 72 },
      { label: "3+ days", max: Infinity },
    ]),
    leadTime: bucketize(leadDays, [
      { label: "Same day", max: 1 },
      { label: "1–2 days", max: 3 },
      { label: "3–7 days", max: 8 },
      { label: "8–14 days", max: 15 },
      { label: "15+ days", max: Infinity },
    ]),
    categories: Object.entries(CATEGORY_LABELS)
      .map(([key, label]) => ({ label, value: appointments.filter((a) => (a.visitor_category || "external") === key).length })),
    groupSizes: bucketize(groupSizes, [
      { label: "1 person", max: 2 },
      { label: "2 people", max: 3 },
      { label: "3–5 people", max: 6 },
      { label: "6+ people", max: Infinity },
    ]),
    durations: [
      { label: "30 minutes", value: appointments.filter((a) => a.duration !== 60).length },
      { label: "1 hour", value: appointments.filter((a) => a.duration === 60).length },
    ],
    weekdays: WEEKDAYS.map((label, i) => ({ label, value: weekdayCounts[i] })),
    offices,
    topPeopleToMeet: topCounts(appointments.map((a) => a.person_to_meet), 10),
    topValidIds: topCounts(appointments.map((a) => a.valid_id), 8),
  };
}
