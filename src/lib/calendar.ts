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
  start: Date;
  end: Date;
  attendees?: string[];
}

export async function createCalendarEvent({ title, description, start, end, attendees }: CalendarEventParams): Promise<{ id: string; htmlLink: string | null | undefined }> {
  const client = getServiceAccountAuth();
  const calendarId = getCalendarId();

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
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: attendees?.map((email) => ({ email })),
    },
  });

  return { id: data.id || "", htmlLink: data.htmlLink };
}
