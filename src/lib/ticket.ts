import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { formatTimeSlot } from "@/lib/time";
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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 60;

const GREEN = rgb(0, 0.4, 0.2);
const DARK = rgb(0.07, 0.07, 0.07);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_GRAY = rgb(0.6, 0.6, 0.6);
const WHITE = rgb(1, 1, 1);

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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
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

function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color: ReturnType<typeof rgb>) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size, font, color });
}

function drawCenteredAt(page: PDFPage, x: number, text: string, font: PDFFont, size: number, y: number, color: ReturnType<typeof rgb>) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x - width / 2, y, size, font, color });
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateTicketPdf(data: TicketData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 1. Green header (#006633) with white OASYS logo.
  const headerHeight = 120;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: GREEN,
  });

  const logo = await getLogo();
  const logoImage = await pdfDoc.embedPng(logo.bytes);
  const logoHeight = 52;
  const logoWidth = logoHeight * (logo.width / logo.height);
  page.drawImage(logoImage, {
    x: (PAGE_WIDTH - logoWidth) / 2,
    y: PAGE_HEIGHT - 74,
    width: logoWidth,
    height: logoHeight,
  });

  // 3. Title on white background.
  const titleY = PAGE_HEIGHT - headerHeight - 40;
  drawCentered(page, "VISITOR APPOINTMENT TICKET", bold, 24, titleY, DARK);

  // 4 + 5. Solid green box: small "REFERENCE NUMBER" label on top, bigger number below,
  // with the QR code for the reference number beside it.
  const numberSize = 27;
  const numberWidth = bold.widthOfTextAtSize(data.referenceNumber, numberSize);
  const refBoxWidth = Math.max(280, numberWidth + 40);
  const refBoxHeight = 64;
  const refBoxTop = titleY - 40;
  const qrSize = 64;
  const gap = 18;
  const groupWidth = refBoxWidth + gap + qrSize;
  const groupLeft = (PAGE_WIDTH - groupWidth) / 2;
  const refBoxLeft = groupLeft;
  const refCenter = refBoxLeft + refBoxWidth / 2;

  const qrPng = await generateQrPng(data.referenceNumber, 384);
  const qrImage = await pdfDoc.embedPng(qrPng);

  page.drawRectangle({
    x: refBoxLeft,
    y: refBoxTop - refBoxHeight,
    width: refBoxWidth,
    height: refBoxHeight,
    color: GREEN,
  });
  page.drawImage(qrImage, {
    x: refBoxLeft + refBoxWidth + gap,
    y: refBoxTop - qrSize,
    width: qrSize,
    height: qrSize,
  });
  drawCenteredAt(page, refCenter, "REFERENCE NUMBER", regular, 9, refBoxTop - 18, WHITE);
  drawCenteredAt(page, refCenter, data.referenceNumber, bold, numberSize, refBoxTop - 40, WHITE);

  // 6. Notes with the long text wrapped so it continues on the line below.
  const notes = [
    "Present this ticket or your reference number at USLS Gate 2 on your appointment date.",
    "Bring the government-issued ID listed above — the Guard will issue your visitor's pass.",
    "Please arrive at Gate 2 by 20 minutes before your scheduled time.",
    "Entry is allowed only from 30 minutes before the scheduled time; arriving 15 minutes after voids the gate entry code.",
  ];
  const noteSize = 10;
  const noteLineHeight = 15;
  const bulletX = MARGIN + 18;
  const noteTextX = MARGIN + 34;
  const noteMaxWidth = PAGE_WIDTH - MARGIN - noteTextX;
  let cursorY = refBoxTop - refBoxHeight - 18;
  for (const note of notes) {
    const lines = wrapText(note, regular, noteSize, noteMaxWidth);
    for (let i = 0; i < lines.length; i++) {
      const text = i === 0 ? `• ${lines[i]}` : lines[i];
      page.drawText(text, {
        x: i === 0 ? bulletX : noteTextX,
        y: cursorY,
        size: noteSize,
        font: regular,
        color: GRAY,
      });
      cursorY -= noteLineHeight;
    }
  }
  cursorY -= 24;

  // 7. Appointment details.
  const labelX = MARGIN;
  const valueX = MARGIN + 150;
  const valueMaxWidth = PAGE_WIDTH - MARGIN - valueX;

  const drawRow = (label: string, value: string, valueFont: PDFFont = regular) => {
    const lines = wrapText(value, valueFont, 11, valueMaxWidth);
    page.drawText(label, { x: labelX, y: cursorY, size: 11, font: regular, color: LIGHT_GRAY });
    lines.forEach((line, index) => {
      page.drawText(line, { x: valueX, y: cursorY - index * 15, size: 11, font: valueFont, color: DARK });
    });
    cursorY -= Math.max(lines.length, 1) * 15 + 13;
  };

  drawRow("Visitor", data.visitorName, bold);
  drawRow("Date", formatDate(data.date));
  drawRow("Time", `${formatTimeSlot(data.timeSlot)} (${data.duration} minutes)`);
  if (data.personToMeet) drawRow("Person to Meet", data.personToMeet);
  if (data.purpose) drawRow("Purpose of Visit", data.purpose);

  const vehicles = data.vehicles || [];
  if (vehicles.length > 0) {
    cursorY -= 6;
    page.drawText("REGISTERED VEHICLES", { x: labelX, y: cursorY, size: 10, font: bold, color: GREEN });
    cursorY -= 20;
    vehicles.forEach((vehicle, index) => {
      const suffix = vehicle.makeModel ? ` — ${vehicle.makeModel}` : "";
      drawRow(`Vehicle ${index + 1}`, `${vehicle.plateNumber}${suffix}`);
    });
  }

  // 8. Footer.
  drawCentered(page, "This reference number is single-use and will be disabled after entry.", regular, 9, 52, LIGHT_GRAY);
  drawCentered(page, `OASYS — Online Appointment System • University of St. La Salle • Issued ${formatDate(new Date().toISOString().slice(0, 10))}`, regular, 8, 38, LIGHT_GRAY);

  return pdfDoc.save();
}