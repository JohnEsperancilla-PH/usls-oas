import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, RGB } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { formatTimeSlot, getManilaToday } from "@/lib/time";
import { getArrivalNote, getEntryRuleNote } from "@/lib/entry-window";
import { getEntryWindow } from "@/lib/entry-window-server";
import { generateQrPng } from "@/lib/qr";

export interface TicketVehicle {
  plateNumber: string;
  makeModel?: string | null;
}

export interface TicketData {
  referenceNumber: string;
  visitorName: string;
  officeName: string;
  date: string;
  timeSlot: string;
  duration: number;
  validId?: string | null;
  personToMeet?: string | null;
  purpose?: string | null;
  vehicles?: TicketVehicle[];
}

// Single-page ticket in the style of the approval / invitation email: edge-to-edge green header with
// the logo, title with a green accent bar, gate notes, the reference number and a large QR code,
// the appointment details, and a footer. The page is A4 wide and as tall as its content, so nothing is
// squeezed when a ticket has a long purpose or several vehicles. It is drawn fresh on every download
// from the appointment's current data, so older invitations also come out in this format.

const PAGE_WIDTH = 595.28; // A4 width; the height follows the content
const SIDE = 56;
const CONTENT_LEFT = SIDE;
const CONTENT_WIDTH = PAGE_WIDTH - SIDE * 2;

const QR_SIZE = 240;

const hex = (value: string): RGB => {
  const n = parseInt(value.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const C = {
  white: hex("#ffffff"),
  green: hex("#006633"),
  greenTint: hex("#f0fdf4"),
  title: hex("#111111"),
  body: hex("#4b5563"),
  label: hex("#6b7280"),
  muted: hex("#9ca3af"),
  line: hex("#e5e7eb"),
};

let logoPngCache: { bytes: Uint8Array; width: number; height: number } | null = null;

async function getLogo(): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (!logoPngCache) {
    const png = readFileSync(join(process.cwd(), "public", "usls-oas-white.png"));
    const bytes = await sharp(png).resize(600).png().toBuffer();
    const meta = await sharp(bytes).metadata();
    logoPngCache = { bytes, width: meta.width || 600, height: meta.height || 200 };
  }
  return logoPngCache;
}

/** The standard PDF fonts only cover Western characters; anything else would stop the PDF (and the email it rides on). */
function safeText(font: PDFFont, text: string): string {
  return Array.from(text.replace(/\s+/g, " ").trim(), (ch) => {
    try {
      font.encodeText(ch);
      return ch;
    } catch {
      return "?";
    }
  }).join("");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safeText(font, text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** SVG path (origin top-left, y down) for a rectangle with rounded corners. */
function roundedRect(width: number, height: number, r: number): string {
  return [
    `M ${r} 0`, `H ${width - r}`, `Q ${width} 0 ${width} ${r}`,
    `V ${height - r}`, `Q ${width} ${height} ${width - r} ${height}`,
    `H ${r}`, `Q 0 ${height} 0 ${height - r}`,
    `V ${r}`, `Q 0 0 ${r} 0`, "Z",
  ].join(" ");
}

export async function generateTicketPdf(data: TicketData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`USLS OASYS Visitor Ticket ${data.referenceNumber}`);
  pdfDoc.setAuthor("University of St. La Salle - OASYS");
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Positions are measured from the top of the page; pdf-lib's y axis starts at the bottom.
  // (The page itself is added once the content has been measured, below.)
  const y = (top: number) => pageHeight - top;
  const text = (value: string, x: number, top: number, size: number, font: PDFFont, color: RGB) =>
    page.drawText(safeText(font, value), { x, y: y(top) - size * 0.78, size, font, color });
  const rightText = (value: string, right: number, top: number, size: number, font: PDFFont, color: RGB) => {
    const safe = safeText(font, value);
    page.drawText(safe, { x: right - font.widthOfTextAtSize(safe, size), y: y(top) - size * 0.78, size, font, color });
  };
  const centered = (value: string, top: number, size: number, font: PDFFont, color: RGB) => {
    const safe = safeText(font, value);
    page.drawText(safe, { x: (PAGE_WIDTH - font.widthOfTextAtSize(safe, size)) / 2, y: y(top) - size * 0.78, size, font, color });
  };
  const spacedWidth = (value: string, size: number, font: PDFFont, spacing: number) =>
    font.widthOfTextAtSize(value, size) + spacing * Math.max(0, value.length - 1);
  const spaced = (value: string, left: number | "center", top: number, size: number, font: PDFFont, color: RGB, spacing: number) => {
    const safe = safeText(font, value);
    let x = left === "center" ? (PAGE_WIDTH - spacedWidth(safe, size, font, spacing)) / 2 : left;
    for (const ch of safe) {
      page.drawText(ch, { x, y: y(top) - size * 0.78, size, font, color });
      x += font.widthOfTextAtSize(ch, size) + spacing;
    }
  };
  const box = (left: number, top: number, width: number, height: number, r: number, opts: { color?: RGB; borderColor?: RGB; borderWidth?: number }) =>
    page.drawSvgPath(roundedRect(width, height, r), { x: left, y: y(top), ...opts });
  const hairline = (top: number, left = CONTENT_LEFT, right = CONTENT_LEFT + CONTENT_WIDTH) =>
    page.drawLine({ start: { x: left, y: y(top) }, end: { x: right, y: y(top) }, thickness: 0.6, color: C.line });

  // ---- Content, measured first so the page can be exactly as tall as it needs ----
  const entryWindow = await getEntryWindow();
  const validId = data.validId?.trim();
  const notes = [
    "Present this ticket or your reference number at USLS Gate 2 on your appointment date.",
    validId
      ? `Bring your ${validId}. The guard will check it and issue your visitor's pass.`
      : "Bring a government-issued ID. The guard will check it and issue your visitor's pass.",
    getArrivalNote(entryWindow),
    getEntryRuleNote(entryWindow),
  ];
  const NOTE_SIZE = 10;
  const NOTE_LINE = 15;
  const noteLines = notes.map((note) => wrapText(note, regular, NOTE_SIZE, CONTENT_WIDTH - 16));

  const vehicles = data.vehicles || [];
  const rows: [string, string][] = [
    ["Visitor", data.visitorName],
    ["Office", data.officeName],
    ["Date", formatDate(data.date)],
    ["Time", `${formatTimeSlot(data.timeSlot)} (${data.duration} minutes)`],
    ...(data.personToMeet ? [["Person to Meet", data.personToMeet] as [string, string]] : []),
    ...(data.purpose ? [["Purpose of Visit", data.purpose] as [string, string]] : []),
    ...(validId ? [["Valid ID", validId] as [string, string]] : []),
    ...vehicles.map((v, i) => [vehicles.length > 1 ? `Vehicle ${i + 1}` : "Vehicle", `${v.plateNumber}${v.makeModel ? ` - ${v.makeModel}` : ""}`] as [string, string]),
  ];
  const ROW_SIZE = 10.5;
  const ROW_LINE = 14;
  const LABEL_WIDTH = 130;
  const rowLines = rows.map(([, value]) => wrapText(value, bold, ROW_SIZE, CONTENT_WIDTH - LABEL_WIDTH));

  // Vertical layout.
  const HEADER = 104;
  const FOOTER = 58;
  const TITLE_SIZE = 20;
  const TITLE_BLOCK = TITLE_SIZE + 8 + 3; // title, gap, accent bar
  const NOTES_BLOCK = noteLines.reduce((sum, lines) => sum + lines.length * NOTE_LINE, 0);
  const REF_LABEL = 9, REF_LABEL_GAP = 8, REF_BOX = 50, REF_GAP = 16, QR_NOTE_GAP = 10, QR_NOTE = 9;
  const REFERENCE_BLOCK = REF_LABEL + REF_LABEL_GAP + REF_BOX + REF_GAP + QR_SIZE + QR_NOTE_GAP + QR_NOTE;
  const DETAILS_HEADING = 9 + 10;
  const ROW_PAD = 7;
  const rowHeights = rowLines.map((lines) => ROW_PAD * 2 + lines.length * ROW_LINE);
  const gaps = [30, 18, 30, 34, 34]; // header→title, title→notes, notes→reference, reference→details, details→footer
  const qrSize = QR_SIZE;
  const pageHeight = Math.ceil(
    HEADER + TITLE_BLOCK + NOTES_BLOCK + REFERENCE_BLOCK + DETAILS_HEADING
    + rowHeights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) + FOOTER
  );
  const page = pdfDoc.addPage([PAGE_WIDTH, pageHeight]);

  // ---- Header: edge-to-edge green band with the white logo ----
  page.drawRectangle({ x: 0, y: y(HEADER), width: PAGE_WIDTH, height: HEADER, color: C.green });
  const logo = await getLogo();
  const logoImage = await pdfDoc.embedPng(logo.bytes);
  const logoWidth = 170;
  const logoHeight = logoWidth * (logo.height / logo.width);
  page.drawImage(logoImage, { x: (PAGE_WIDTH - logoWidth) / 2, y: y((HEADER + logoHeight) / 2), width: logoWidth, height: logoHeight });

  let top = HEADER + gaps[0];

  // ---- Title with the green accent bar ----
  text("Visitor Appointment Ticket", CONTENT_LEFT, top, TITLE_SIZE, bold, C.title);
  top += TITLE_SIZE + 8;
  box(CONTENT_LEFT, top, 36, 3, 1.5, { color: C.green });
  top += 3 + gaps[1];

  // ---- Gate notes ----
  for (const lines of noteLines) {
    lines.forEach((line, i) => {
      if (i === 0) box(CONTENT_LEFT + 1, top + 4, 3.5, 3.5, 1.75, { color: C.green });
      text(line, CONTENT_LEFT + 16, top, NOTE_SIZE, regular, C.body);
      top += NOTE_LINE;
    });
  }
  top += gaps[2];

  // ---- Reference number and QR code ----
  spaced("REFERENCE NUMBER", "center", top, 9, bold, C.muted, 1.2);
  top += REF_LABEL + REF_LABEL_GAP;
  const refWidth = Math.min(CONTENT_WIDTH, 340);
  box((PAGE_WIDTH - refWidth) / 2, top, refWidth, REF_BOX, 8, { color: C.greenTint });
  let refSize = 30;
  while (refSize > 16 && spacedWidth(data.referenceNumber, refSize, bold, 7) > refWidth - 32) refSize -= 1;
  spaced(data.referenceNumber, "center", top + (REF_BOX - refSize * 0.72) / 2, refSize, bold, C.green, 7);
  top += REF_BOX + REF_GAP;

  const qrPng = await generateQrPng(data.referenceNumber, 800);
  const qrImage = await pdfDoc.embedPng(qrPng);
  const qrLeft = (PAGE_WIDTH - qrSize) / 2;
  box(qrLeft, top, qrSize, qrSize, 10, { color: C.white, borderColor: C.line, borderWidth: 1 });
  page.drawImage(qrImage, { x: qrLeft + 6, y: y(top + qrSize - 6), width: qrSize - 12, height: qrSize - 12 });
  top += qrSize + QR_NOTE_GAP;
  centered("Single-use. This code is disabled once you enter campus.", top, QR_NOTE, regular, C.muted);
  top += QR_NOTE + gaps[3];

  // ---- Appointment details ----
  spaced("APPOINTMENT DETAILS", CONTENT_LEFT, top, 9, bold, C.green, 1.2);
  top += DETAILS_HEADING;
  hairline(top);
  rows.forEach(([label], index) => {
    text(label, CONTENT_LEFT, top + ROW_PAD, ROW_SIZE, regular, C.label);
    rowLines[index].forEach((line, i) => rightText(line, CONTENT_LEFT + CONTENT_WIDTH, top + ROW_PAD + i * ROW_LINE, ROW_SIZE, bold, C.title));
    top += rowHeights[index];
    hairline(top);
  });

  // ---- Footer at the bottom of the page ----
  const footerTop = pageHeight - FOOTER;
  hairline(footerTop, 0, PAGE_WIDTH);
  centered("Center for Marketing and Communications  ·  University of St. La Salle", footerTop + 14, 8.5, regular, C.green);
  centered(`© ${new Date().getFullYear()} OASYS - Online Appointment System  ·  Ticket issued ${formatDate(getManilaToday())}`, footerTop + 30, 8, regular, C.muted);

  return pdfDoc.save();
}
