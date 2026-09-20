import QRCode from "qrcode";
import type { QRCodeToBufferOptions } from "qrcode";

const DEFAULT_OPTIONS: QRCodeToBufferOptions = {
  width: 320,
  margin: 2,
  errorCorrectionLevel: "M",
};

export function generateQrPng(text: string, size = 320): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...DEFAULT_OPTIONS, width: size });
}