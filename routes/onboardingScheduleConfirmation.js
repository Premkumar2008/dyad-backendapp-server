import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildHtmlTemplate = (data) => {
  const {
    contactName,
    dateDisplay,
    timeDisplay,
    timezone,
    email,
    phone,
    titleRole,
    meetingLink,
    joinMeetingLabel,
    calendarEmail,
  } = data;

  const detailRow = (label, value) =>
    value
      ? `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e8ecf2;font-weight:600;color:#0a2d6e;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8ecf2;color:#444;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`
      : "";

  const timeWithZone = timezone ? `${timeDisplay || ""} (${timezone})` : timeDisplay || "";

  const meetBlock = meetingLink
    ? `
      <div style="margin:24px 0 0;padding:22px 20px;background:#eef6fb;border:1px solid #c5d4ea;border-radius:8px;text-align:center;">
        <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#0a2d6e;letter-spacing:0.02em;">GOOGLE MEET</p>
        <a href="${escapeHtml(meetingLink)}" style="display:inline-block;padding:12px 28px;background:#0a2d6e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:7px;">${escapeHtml(joinMeetingLabel || "Join Google Meet")}</a>
        <p style="margin:14px 0 0;font-size:13px;color:#546e7a;word-break:break-all;">
          <a href="${escapeHtml(meetingLink)}" style="color:#0a2d6e;font-weight:600;">${escapeHtml(meetingLink)}</a>
        </p>
        ${calendarEmail ? `<p style="margin:12px 0 0;font-size:13px;color:#546e7a;">Calendar invite from <strong>${escapeHtml(calendarEmail)}</strong></p>` : ""}
      </div>`
    : "";

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You have scheduled Meeting with Dyad Practice Solutions</title>
      </head>
      <body style="font-family:Arial,sans-serif;line-height:1.7;color:#333;margin:0;padding:0;background:#f4f4f4;">
        <div style="background:#f4f4f4;padding:30px 0;">
          <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <div style="padding:24px 32px;border-bottom:2px solid #0a2d6e;">
              <img src="https://landing-dev.dyadmd.com/assets/images/logo_main.png" alt="Dyad Practice Solutions" style="height:72px;width:auto;" />
            </div>
            <div style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#444;">Dear ${escapeHtml(contactName || "there")},</p>
              <p style="margin:0 0 16px;font-size:15px;color:#444;">Thank you for scheduling your introduction call with <strong>Dyad Practice Solutions</strong>. Below are your confirmed meeting details.</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0 0;font-size:14px;background:#fafbfd;border:1px solid #e8ecf2;border-radius:8px;overflow:hidden;">
                <tbody>
    ${detailRow("Date", dateDisplay)}
    ${detailRow("Time", timeWithZone)}
    ${detailRow("Name", contactName)}
    ${detailRow("Title / Role", titleRole)}
    ${detailRow("Email", email)}
    ${detailRow("Phone", phone)}</tbody>
              </table>
              ${meetBlock}
              <p style="margin:24px 0 0;font-size:15px;color:#444;">Regards,<br/><strong style="color:#0a2d6e;">The Dyad Team</strong><br/>Dyad Practice Solutions</p>
            </div>
            <div style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#888;">Dyad Practice Solutions, LLC &middot; <a href="https://landing-dev.dyadmd.com" style="color:#0a2d6e;">dyadmd.com</a></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
};

const buildTextTemplate = (data) => {
  const {
    contactName,
    dateDisplay,
    timeDisplay,
    timezone,
    email,
    phone,
    titleRole,
    meetingLink,
    calendarEmail,
  } = data;

  const lines = [
    `Dear ${contactName || "there"},`,
    "Thank you for scheduling your introduction call with Dyad Practice Solutions.",
    "MEETING DETAILS",
  ];

  if (dateDisplay) lines.push(`Date: ${dateDisplay}`);
  if (timeDisplay) lines.push(`Time: ${timeDisplay}${timezone ? ` (${timezone})` : ""}`);
  if (contactName) lines.push(`Name: ${contactName}`);
  if (titleRole) lines.push(`Title / Role: ${titleRole}`);
  if (email) lines.push(`Email: ${email}`);
  if (phone) lines.push(`Phone: ${phone}`);
  if (meetingLink) lines.push(`Join Google Meet: ${meetingLink}`);
  if (calendarEmail) lines.push(`Calendar invite from: ${calendarEmail}`);

  lines.push("We look forward to speaking with you.", "Dyad Practice Solutions");

  return lines.join("\n");
};

router.post("/send-onboarding-schedule-confirmation", async (req, res) => {
  try {
    const {
      to,
      subject,
      html,
      htmlBody,
      bodyHtml,
      text,
      contactName,
      dateDisplay,
      timeDisplay,
      timezone,
      email,
      phone,
      titleRole,
      joinMeetingLabel,
      calendarEmail,
      meetingLink,
      meetLink,
      googleMeetLink,
      joinUrl,
    } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Recipient (to) is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid recipient email address",
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        message: "Email service is not configured. Please contact support.",
      });
    }

    const resolvedMeetingLink =
      meetingLink || meetLink || googleMeetLink || joinUrl || null;

    const templateData = {
      contactName,
      dateDisplay,
      timeDisplay,
      timezone,
      email,
      phone,
      titleRole,
      joinMeetingLabel,
      calendarEmail,
      meetingLink: resolvedMeetingLink,
    };

    const finalHtml = html || htmlBody || bodyHtml || buildHtmlTemplate(templateData);
    const finalText = text || buildTextTemplate(templateData);
    const finalSubject =
      subject || "You have scheduled Meeting with Dyad Practice Solutions";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Dyad Practice Solutions" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to,
      subject: finalSubject,
      text: finalText,
      html: finalHtml,
    });

    res.status(200).json({
      success: true,
      message: "Onboarding schedule confirmation email sent successfully",
      messageId: info.messageId,
      to,
    });
  } catch (err) {
    console.error("Onboarding schedule confirmation email error:", err);

    if (err.code === "EAUTH") {
      return res.status(500).json({
        success: false,
        message: "Email authentication failed. Please contact support.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to send onboarding schedule confirmation email",
    });
  }
});

export default router;
