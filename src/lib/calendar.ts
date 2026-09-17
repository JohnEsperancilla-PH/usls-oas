import { google } from "googleapis";

let cachedJwt: InstanceType<typeof google.auth.JWT> | null = null;

function getSubject(): string | null {
  return process.env.GOOGLE_CALENDAR_AS || process.env.GOOGLE_CALENDAR_OWNER || null;
}

function getServiceAccountAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  const scopes = ["https://www.googleapis.com/auth/calendar.events"];
  const subject = getSubject();

  if (raw) {
    try {
      const creds = JSON.parse(raw);
      if (!cachedJwt) {
        cachedJwt = new google.auth.JWT({
          email: creds.client_email,
          key: creds.private_key,
          scopes,
          subject: subject || undefined,
        });
      }
      return cachedJwt;
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT env var is not valid JSON");
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (email && key) {
    return new google.auth.JWT({
      email,
      key: key.replace(/\\n/g, "\n"),
      scopes,
      subject: subject || undefined,
    });
  }

  return null;
}

function getCalendarId(): string | null {
  return process.env.GOOGLE_CALENDAR_ID || "appointment@usls.edu.ph";
}

export interface CalendarEventParams {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  timeZone?: string;
}

const DEFAULT_TIME_ZONE = "Asia/Manila";

function formatWallClock(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

export async function createCalendarEvent({ title, description, location, start, end, attendees, timeZone }: CalendarEventParams): Promise<{ id: string; htmlLink: string | null | undefined }> {
  const client = getServiceAccountAuth();
  const calendarId = getCalendarId();
  const tz = timeZone || DEFAULT_TIME_ZONE;

  if (!client || !calendarId) {
    throw new Error("Google Calendar is not configured (missing GOOGLE_SERVICE_ACCOUNT or GOOGLE_CALENDAR_ID)");
  }

  const calendar = google.calendar({ version: "v3", auth: client });

  const { data } = await calendar.events.insert({
    calendarId,
    sendUpdates: "all",
    requestBody: {
      summary: title,
      description,
      location,
      start: { dateTime: formatWallClock(start, tz), timeZone: tz },
      end: { dateTime: formatWallClock(end, tz), timeZone: tz },
      attendees: attendees?.map((email) => ({ email })),
    },
  });

  return { id: data.id || "", htmlLink: data.htmlLink };
}
