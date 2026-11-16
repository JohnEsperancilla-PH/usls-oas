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

// The ticket follows the approval / invitation email: grey page, white card, green header with the
// logo, title with a green accent bar, gate notes, a dashed reference panel with a large QR code,
// a green-tinted details table, and a light footer. It is drawn fresh on every download from the
// appointment's current data, so older invitations also come out in this format.

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 24;
const CARD_WIDTH = 500;
const CARD_LEFT = (PAGE_WIDTH - CARD_WIDTH) / 2;
const PAD = 28;
const CONTENT_LEFT = CARD_LEFT + PAD;
const CONTENT_WIDTH = CARD_WIDTH - PAD * 2;

const QR_MAX = 230;
const QR_MIN = 140;

const hex = (value: string): RGB => {
  const n = parseInt(value.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const C = {
  page: hex("#f0f2f5"),
  white: hex("#ffffff"),
  green: hex("#006633"),
  title: hex("#111111"),
  body: hex("#555555"),
  label: hex("#666666"),
  muted: hex("#888888"),
  faint: hex("#999999"),
  panel: hex("#f9fafb"),
  panelBorder: hex("#d1d5db"),
  details: hex("#f0fdf4"),
  detailsLine: hex("#dcefe2"),
  footer: hex("#fafafa"),
  footerLine: hex("#eeeeee"),
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

/** SVG path (origin top-left, y down) for a rectangle with rounded corners; pdf-lib draws it at a given top-left point. */
function roundedRect(width: number, height: number, r: number, corners = { top: true, bottom: true }): string {
  const t = corners.top ? r : 0;
  const b = corners.bottom ? r : 0;
  return [
    `M ${t} 0`, `H ${width - t}`, `Q ${width} 0 ${width} ${t}`,
    `V ${height - b}`, `Q ${width} ${height} ${width - b} ${height}`,
    `H ${b}`, `Q 0 ${height} 0 ${height - b}`,
    `V ${t}`, `Q 0 0 ${t} 0`, "Z",
  ].join(" ");
}

export async function generateTicketPdf(data: TicketData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`USLS OASYS Visitor Ticket ${data.referenceNumber}`);
  pdfDoc.setAuthor("University of St. La Salle - OASYS");
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Positions are measured from the top of the page; pdf-lib's y axis starts at the bottom.
  const y = (top: number) => PAGE_HEIGHT - top;
  const text = (value: string, x: number, top: number, size: number, font: PDFFont, color: RGB) =>
    page.drawText(safeText(font, value), { x, y: y(top) - size * 0.78, size, font, color });
  const centered = (value: string, top: number, size: number, font: PDFFont, color: RGB, centerX = PAGE_WIDTH / 2) => {
    const safe = safeText(font, value);
    page.drawText(safe, { x: centerX - font.widthOfTextAtSize(safe, size) / 2, y: y(top) - size * 0.78, size, font, color });
  };
  const spacedWidth = (value: string, size: number, font: PDFFont, spacing: number) =>
    font.widthOfTextAtSize(value, size) + spacing * Math.max(0, value.length - 1);
  const spaced = (value: string, top: number, size: number, font: PDFFont, color: RGB, spacing: number) => {
    const safe = safeText(font, value);
    let x = PAGE_WIDTH / 2 - spacedWidth(safe, size, font, spacing) / 2;
    for (const ch of safe) {
      page.drawText(ch, { x, y: y(top) - size * 0.78, size, font, color });
      x += font.widthOfTextAtSize(ch, size) + spacing;
    }
  };
  const box = (left: number, top: number, width: number, height: number, r: number, opts: { color?: RGB; borderColor?: RGB; borderWidth?: number; dash?: number[]; corners?: { top: boolean; bottom: boolean } }) =>
    page.drawSvgPath(roundedRect(width, height, r, opts.corners), {
      x: left,
      y: y(top),
      color: opts.color,
      borderColor: opts.borderColor,
      borderWidth: opts.borderWidth,
      borderDashArray: opts.dash,
    });

  // ---- Content, prepared first so the QR code can take whatever height is left on the page ----
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
  const NOTE_SIZE = 9.5;
  const NOTE_LINE = 12.5;
  const noteLines = notes.map((note) => wrapText(note, regular, NOTE_SIZE, CONTENT_WIDTH - 14));

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
  const ROW_SIZE = 10;
  const ROW_LINE = 13;
  const ROW_PAD = 5;
  const LABEL_WIDTH = 118;
  const valueWidth = CONTENT_WIDTH - 32 - LABEL_WIDTH;
  const rowLines = rows.map(([, value]) => wrapText(value, bold, ROW_SIZE, valueWidth));
  const rowHeights = rowLines.map((lines) => ROW_PAD * 2 + lines.length * ROW_LINE);

  // Vertical layout, shared by the measuring below and the drawing after it.
  const HEADER = 72;
  const TITLE_PAD = 20, TITLE_SIZE = 16, TITLE_GAP = 6, BAR = 3, BAR_GAP = 12;
  const TITLE_BLOCK = TITLE_PAD + TITLE_SIZE + TITLE_GAP + BAR + BAR_GAP;
  const NOTES_GAP = 12;
  const NOTES_BLOCK = noteLines.reduce((sum, lines) => sum + lines.length * NOTE_LINE, 0) + NOTES_GAP;
  const P_PAD = 14, P_LABEL = 9, P_LABEL_GAP = 6, REF_BOX = 40, REF_GAP = 12;
  const PANEL_FIXED = P_PAD + P_LABEL + P_LABEL_GAP + REF_BOX + REF_GAP + P_PAD;
  const NOTE_ABOVE = 6, NOTE_SIZE_SMALL = 8.5, NOTE_GAP = 12;
  const NOTE_BELOW = NOTE_ABOVE + 10 + NOTE_GAP;
  const D_PAD = 10, D_HEADING = 14;
  const DETAILS = D_PAD + D_HEADING + rowHeights.reduce((a, b) => a + b, 0) + 4;
  const BEFORE_FOOTER = 14;
  const FOOTER = 50;
  const fixed = HEADER + TITLE_BLOCK + NOTES_BLOCK + PANEL_FIXED + NOTE_BELOW + DETAILS + BEFORE_FOOTER + FOOTER;
  const qrSize = Math.round(Math.min(QR_MAX, Math.max(QR_MIN, PAGE_HEIGHT - PAGE_MARGIN * 2 - fixed)));
  const cardHeight = fixed + qrSize;
  const cardTop = Math.max(PAGE_MARGIN, (PAGE_HEIGHT - cardHeight) / 2);

  // ---- Page and card ----
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: C.page });
  box(CARD_LEFT, cardTop, CARD_WIDTH, cardHeight, 10, { color: C.white, borderColor: hex("#e5e7eb"), borderWidth: 0.6 });

  // Green header with the white logo (top corners rounded like the card).
  box(CARD_LEFT, cardTop, CARD_WIDTH, HEADER, 10, { color: C.green, corners: { top: true, bottom: false } });
  const logo = await getLogo();
  const logoImage = await pdfDoc.embedPng(logo.bytes);
  const logoWidth = 150;
  const logoHeight = logoWidth * (logo.height / logo.width);
  page.drawImage(logoImage, { x: (PAGE_WIDTH - logoWidth) / 2, y: y(cardTop + (HEADER + logoHeight) / 2), width: logoWidth, height: logoHeight });

  let top = cardTop + HEADER + TITLE_PAD;

  // Title with the green accent bar.
  text("Visitor Appointment Ticket", CONTENT_LEFT, top, TITLE_SIZE, bold, C.title);
  top += TITLE_SIZE + TITLE_GAP;
  box(CONTENT_LEFT, top, 32, BAR, 1.5, { color: C.green });
  top += BAR + BAR_GAP;

  // Gate notes (the email's bullet list).
  for (const lines of noteLines) {
    lines.forEach((line, i) => {
      if (i === 0) text("•", CONTENT_LEFT + 2, top, NOTE_SIZE, regular, C.body);
      text(line, CONTENT_LEFT + 14, top, NOTE_SIZE, regular, C.body);
      top += NOTE_LINE;
    });
  }
  top += NOTES_GAP;

  // Dashed reference panel: label, reference in a green-bordered box, large QR code.
  const panelHeight = PANEL_FIXED + qrSize;
  box(CONTENT_LEFT, top, CONTENT_WIDTH, panelHeight, 10, { color: C.panel, borderColor: C.panelBorder, borderWidth: 1, dash: [4, 3] });
  let inner = top + P_PAD;
  spaced("REFERENCE NUMBER", inner, 8.5, regular, C.muted, 0.8);
  inner += P_LABEL + P_LABEL_GAP;
  const refLeft = CONTENT_LEFT + 18;
  const refWidth = CONTENT_WIDTH - 36;
  box(refLeft, inner, refWidth, REF_BOX, 6, { color: C.white, borderColor: C.green, borderWidth: 2 });
  let refSize = 26;
  while (refSize > 14 && spacedWidth(data.referenceNumber, refSize, bold, 5) > refWidth - 24) refSize -= 1;
  spaced(data.referenceNumber, inner + (REF_BOX - refSize * 0.72) / 2, refSize, bold, C.green, 5);
  inner += REF_BOX + REF_GAP;
  const qrPng = await generateQrPng(data.referenceNumber, 720);
  const qrImage = await pdfDoc.embedPng(qrPng);
  const qrFrame = qrSize;
  const qrLeft = (PAGE_WIDTH - qrFrame) / 2;
  box(qrLeft, inner, qrFrame, qrFrame, 6, { color: C.white, borderColor: C.green, borderWidth: 2 });
  page.drawImage(qrImage, { x: qrLeft + 6, y: y(inner + qrFrame - 6), width: qrFrame - 12, height: qrFrame - 12 });
  top += panelHeight + NOTE_ABOVE;

  centered("This reference number is single-use and will be disabled after entry.", top, NOTE_SIZE_SMALL, regular, C.faint);
  top += 10 + NOTE_GAP;

  // Green-tinted details table.
  box(CONTENT_LEFT, top, CONTENT_WIDTH, DETAILS, 8, { color: C.details });
  let rowTop = top + D_PAD;
  const headingSafe = "APPOINTMENT DETAILS";
  let hx = CONTENT_LEFT + 16;
  for (const ch of headingSafe) {
    page.drawText(ch, { x: hx, y: y(rowTop) - 8 * 0.78, size: 8, font: bold, color: C.green });
    hx += bold.widthOfTextAtSize(ch, 8) + 0.7;
  }
  rowTop += D_HEADING;
  rows.forEach(([label], index) => {
    const lines = rowLines[index];
    text(label, CONTENT_LEFT + 16, rowTop + ROW_PAD, ROW_SIZE, regular, C.label);
    lines.forEach((line, i) => {
      const width = bold.widthOfTextAtSize(line, ROW_SIZE);
      page.drawText(line, { x: CONTENT_LEFT + CONTENT_WIDTH - 16 - width, y: y(rowTop + ROW_PAD + i * ROW_LINE) - ROW_SIZE * 0.78, size: ROW_SIZE, font: bold, color: C.title });
    });
    rowTop += rowHeights[index];
    if (index < rows.length - 1) {
      page.drawLine({ start: { x: CONTENT_LEFT + 16, y: y(rowTop) }, end: { x: CONTENT_LEFT + CONTENT_WIDTH - 16, y: y(rowTop) }, thickness: 0.6, color: C.detailsLine });
    }
  });

  // Footer band.
  const footerTop = cardTop + cardHeight - FOOTER;
  box(CARD_LEFT, footerTop, CARD_WIDTH, FOOTER, 10, { color: C.footer, corners: { top: false, bottom: true } });
  page.drawLine({ start: { x: CARD_LEFT, y: y(footerTop) }, end: { x: CARD_LEFT + CARD_WIDTH, y: y(footerTop) }, thickness: 0.6, color: C.footerLine });
  centered(`© ${new Date().getFullYear()} OASYS - Online Appointment System`, footerTop + 10, 8, regular, C.faint);
  centered("Center for Marketing and Communications  ·  University of St. La Salle", footerTop + 22, 8, regular, C.green);
  centered(`Ticket issued ${formatDate(getManilaToday())}`, footerTop + 34, 7.5, regular, C.faint);

  return pdfDoc.save();
}
