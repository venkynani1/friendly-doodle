import nodemailer, { type Transporter } from "nodemailer";
import { formatDateTime } from "./format";
import { qrPng } from "./qr";

export type PassEmail = {
  to: string;
  participantName: string;
  employeeId: string;
  eventName: string;
  venue: string;
  startsAt: Date;
  endsAt: Date | null;
  qrToken: string;
  passUrl: string;
  isWalkin: boolean;
};

export type EmailResult = { status: "SENT" | "LOGGED" | "FAILED"; error?: string };

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }
  return transporter;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function buildPassEmail(p: PassEmail) {
  const when = p.endsAt ? `${formatDateTime(p.startsAt)} – ${formatDateTime(p.endsAt)}` : formatDateTime(p.startsAt);
  const subject = `Your pass for ${p.eventName}`;
  const text = [
    `Hi ${p.participantName},`,
    "",
    `You're registered for ${p.eventName}${p.isWalkin ? " (walk-in)" : ""}.`,
    "",
    `When: ${when}`,
    `Where: ${p.venue}`,
    `Employee ID: ${p.employeeId}`,
    "",
    `Your QR token: ${p.qrToken}`,
    "",
    "Show the QR code (attached) at the entry desk. If the camera can't read it, the desk can type in the token above.",
    `Open your pass anytime: ${p.passUrl}`,
    "",
    "Keep this pass to yourself — it can only be used once at each counter.",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#eef1f5;font-family:Segoe UI,Arial,sans-serif;color:#17202e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#2b4acb;color:#ffffff;padding:22px 24px">
<div style="font-size:14px;opacity:.85">Event pass${p.isWalkin ? " · Walk-in" : ""}</div>
<div style="font-size:22px;font-weight:700;margin-top:4px">${escapeHtml(p.eventName)}</div>
</td></tr>
<tr><td style="padding:22px 24px 8px">
<p style="margin:0 0 14px">Hi ${escapeHtml(p.participantName)}, you're registered.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.5">
<tr><td style="color:#5b6577;padding-right:14px">When</td><td>${escapeHtml(when)}</td></tr>
<tr><td style="color:#5b6577;padding-right:14px">Where</td><td>${escapeHtml(p.venue)}</td></tr>
<tr><td style="color:#5b6577;padding-right:14px">Employee ID</td><td>${escapeHtml(p.employeeId)}</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:12px 24px">
<img src="cid:passqr" width="220" height="220" alt="Your QR code" style="display:block;border:0"/>
<div style="font-family:Consolas,monospace;font-size:15px;letter-spacing:.5px;margin-top:10px;padding:8px 12px;background:#eef1f5;border-radius:8px;display:inline-block">${escapeHtml(p.qrToken)}</div>
<div style="font-size:13px;color:#5b6577;margin-top:8px">If the camera can't read the code, the desk can type this token.</div>
</td></tr>
<tr><td align="center" style="padding:8px 24px 26px">
<a href="${escapeHtml(p.passUrl)}" style="display:inline-block;background:#17202e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Open my pass</a>
<p style="font-size:13px;color:#5b6577;margin:16px 0 0">Keep this pass to yourself. Each counter accepts it once.</p>
</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

/** Sends the pass email. Never throws: the result says what happened. */
export async function sendPassEmail(p: PassEmail): Promise<EmailResult> {
  const { subject, text, html } = buildPassEmail(p);
  const t = getTransporter();
  if (!t) {
    console.info(`[email] SMTP not configured — logging instead.\nTo: ${p.to}\nSubject: ${subject}\n\n${text}`);
    return { status: "LOGGED" };
  }
  try {
    const png = await qrPng(p.qrToken);
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: p.to,
      subject,
      text,
      html,
      attachments: [{ filename: "event-pass-qr.png", content: png, cid: "passqr", contentType: "image/png" }],
    });
    return { status: "SENT" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] send failed", message);
    return { status: "FAILED", error: message.slice(0, 500) };
  }
}
