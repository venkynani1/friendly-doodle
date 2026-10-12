import QRCode from "qrcode";

const options = { errorCorrectionLevel: "M" as const, margin: 2, width: 512 };

export function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...options, type: "png" });
}

export function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, options);
}
