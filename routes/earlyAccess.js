import express from "express";
import nodemailer from "nodemailer";
import { pool } from "../config/db.js";

const inviteEmailTemplate = (contactName) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Early Access Invitation – Dyad</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 20px 40px;">
              <img src="https://landing-dev.dyadmd.com/assets/images/logo_main.png" alt="Dyad Practice Solutions" width="180" style="width:180px;display:block;margin-bottom:12px;" />
               </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e0e0e0;margin:0;" />
            </td>
          </tr>

          <!-- Blue Banner -->
          <tr>
            <td style="padding:24px 40px;">
              <div style="background-color:#173e7a;border-radius:6px;padding:20px 24px;">
                <div style="font-size:11px;font-weight:600;color:#a8c8f0;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">SELECTED FOR EARLY ACCESS</div>
                <div style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.4;">Your practice has been chosen for the early release cohort</div>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 40px 8px 40px;font-size:14px;color:#333333;line-height:1.8;">
              <p style="margin:0 0 16px 0;">Dear ${contactName},</p>
              <p style="margin:0 0 16px 0;">We are pleased to invite your practice to join Dyad's early access program ahead of our September 2026 launch.</p>
              <p style="margin:0 0 16px 0;">Your practice has been selected as one of a limited number of practices that will shape Dyad's product roadmap and implementation approach during the final development phase.</p>
              <p style="margin:0 0 16px 0;">As an early access partner, you will receive priority onboarding to institutional-grade infrastructure, FDIC-insured banking workflows, integrated lockbox architecture, and fiduciary-level financial governance. Your operational feedback will directly inform product priorities, workflow design, and integration sequencing before broader release.</p>
              <p style="margin:0 0 16px 0;">To begin, please schedule a brief introduction meeting using the calendar below. We will review your technical environment, discuss integration timelines, and outline how we'll incorporate your feedback throughout the onboarding process.</p>
              <p style="margin:0 0 28px 0;">We appreciate your interest in Dyad and look forward to the opportunity to serve your practice.</p>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:0 40px 28px 40px;font-size:14px;color:#333333;line-height:1.7;">
              <p style="margin:0 0 4px 0;">Warm regards,</p>
              <p style="margin:0 0 2px 0;font-weight:700;color:#1a6faf;">Sroothi Jaikumar</p>
              <p style="margin:0;color:#888888;font-size:13px;">Founder & CEO, Dyad Practice Solutions</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e0e0e0;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f8f8;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#888888;">
                Dyad Practice Solutions, LLC &nbsp;&bull;&nbsp;
                <a href="https://dyadmd.com" style="color:#1a6faf;text-decoration:none;">dyadmd.com</a>
                &nbsp;&bull;&nbsp;
                <a href="https://dyadmd.com/unsubscribe" style="color:#1a6faf;text-decoration:none;">Unsubscribe</a>
                &nbsp;&bull;&nbsp;
                <a href="https://dyadmd.com/privacy" style="color:#1a6faf;text-decoration:none;">Privacy Policy</a>
              </p>
              <p style="margin:0;font-size:11px;color:#aaaaaa;">This invitation is extended to a limited cohort of selected practices. If you no longer wish to participate, please let us know.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const router = express.Router();

router.post("/api-early-access", async (req, res) => {
  try {
    const {
      npi,
      practiceName,
      contactName,
      phoneNumber,
      email,
      title,
      practiceType,
      providers,
      locations,
      claimVolume
    } = req.body;

    // Required field validation
    if (!practiceName || !contactName || !phoneNumber || !email || !title || !practiceType) {
      return res.status(400).json({
        success: false,
        message: "practiceName, contactName, phoneNumber, email, title, and practiceType are required"
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Phone: exactly 10 digits
    const phoneDigits = phoneNumber.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits"
      });
    }

    // NPI: exactly 10 digits when provided
    if (npi !== undefined && npi !== null && npi !== "") {
      const npiDigits = String(npi).replace(/\D/g, "");
      if (npiDigits.length !== 10) {
        return res.status(400).json({
          success: false,
          message: "NPI must be exactly 10 digits"
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO early_access_requests
         (npi, practice_name, contact_name, phone_number, email, title, practice_type, providers, locations, claim_volume)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING
         id, npi, practice_name, contact_name, phone_number, email, title,
         practice_type, providers, locations, claim_volume, status, created_at`,
      [
        npi ? String(npi).trim() : null,
        practiceName.trim(),
        contactName.trim(),
        phoneDigits,
        email.toLowerCase().trim(),
        title.trim(),
        practiceType.trim(),
        providers !== undefined ? String(providers).trim() : null,
        locations !== undefined ? String(locations).trim() : null,
        claimVolume !== undefined ? String(claimVolume).trim() : null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Early access request submitted successfully. We will be in touch soon.",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Early access request error:", err);

    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An early access request with this email already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to submit early access request"
    });
  }
});

router.post("/api-early-access/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "Email address is required"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "Please provide a valid email address"
      });
    }

    const result = await pool.query(
      "SELECT id, status, created_at FROM early_access_requests WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (result.rows.length > 0) {
      const { status, created_at } = result.rows[0];
      return res.status(200).json({
        success: true,
        exists: true,
        status,
        message: `This email has already been registered for early access (status: ${status}). We will reach out to you at ${email.toLowerCase().trim()}.`,
        submittedAt: created_at
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      message: "This email is not yet registered. You are eligible to request early access."
    });

  } catch (err) {
    console.error("Early access check-email error:", err);
    res.status(500).json({
      success: false,
      exists: null,
      message: "Unable to verify email at this time. Please try again later."
    });
  }
});

router.post("/api-early-access/check-npi", async (req, res) => {
  try {
    const { npi } = req.body;

    if (!npi) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "NPI number is required"
      });
    }

    const npiDigits = String(npi).replace(/\D/g, "");
    if (npiDigits.length !== 10) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "NPI must be exactly 10 digits"
      });
    }

    const result = await pool.query(
      "SELECT id, status, created_at FROM early_access_requests WHERE npi = $1",
      [npiDigits]
    );

    if (result.rows.length > 0) {
      const { status, created_at } = result.rows[0];
      return res.status(200).json({
        success: true,
        exists: true,
        status,
        message: `An early access request with this NPI already exists (status: ${status}).`,
        submittedAt: created_at
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      message: "This NPI is not yet registered. You are eligible to request early access."
    });

  } catch (err) {
    console.error("Early access check-npi error:", err);
    res.status(500).json({
      success: false,
      exists: null,
      message: "Unable to verify NPI at this time. Please try again later."
    });
  }
});

router.patch("/api-early-access/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { betaInvite, status, invitationSent } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid ID is required"
      });
    }

    const validStatuses = ["pending", "reviewing", "approved", "rejected", "beta-cohort"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    const result = await pool.query(
      `UPDATE early_access_requests
       SET
         beta_invite      = COALESCE($1, beta_invite),
         status           = COALESCE($2, status),
         invitation_sent  = COALESCE($3, invitation_sent),
         updated_at       = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, npi, practice_name, contact_name, phone_number, email, title,
                 practice_type, providers, locations, claim_volume, status,
                 beta_invite, invitation_sent, send_email_confirm, created_at, updated_at`,
      [
        betaInvite !== undefined ? betaInvite : null,
        status || null,
        invitationSent !== undefined ? invitationSent : null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Early access request not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Early access request updated successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Early access update error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update early access request"
    });
  }
});

router.get("/api-early-access", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, npi, practice_name, contact_name, phone_number, email, title,
              practice_type, providers, locations, claim_volume, status,
              beta_invite, invitation_sent, send_email_confirm, created_at, updated_at
       FROM early_access_requests
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    console.error("Early access fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch early access requests"
    });
  }
});

router.post("/api-early-access/send-invite", async (req, res) => {
  try {
    const { ids, subject, html, text } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids must be a non-empty array"
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        message: "Email service is not configured"
      });
    }

    const result = await pool.query(
      `SELECT id, contact_name, email FROM early_access_requests WHERE id = ANY($1)`,
      [ids]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No records found for the provided IDs"
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const results = await Promise.allSettled(
      result.rows.map(async (row) => {
        await transporter.sendMail({
          from: `"Sroothi Jaikumar – Dyad Practice Solutions" <${process.env.EMAIL_USER}>`,
          replyTo: process.env.EMAIL_USER,
          to: row.email,
          subject: subject || "You've Been Selected for Dyad Early Access",
          html: html || inviteEmailTemplate(row.contact_name),
          ...(text && { text })
        });

        await pool.query(
          `UPDATE early_access_requests
           SET invitation_sent = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [row.id]
        );

        return { id: row.id, email: row.email, status: "sent" };
      })
    );

    const sent = results.filter(r => r.status === "fulfilled").map(r => r.value);
    const failed = results
      .filter(r => r.status === "rejected")
      .map((r, i) => ({ id: result.rows[i].id, error: r.reason?.message }));

    res.status(200).json({
      success: true,
      message: `${sent.length} invite(s) sent${failed.length ? `, ${failed.length} failed` : ""}`,
      sent,
      ...(failed.length && { failed })
    });

  } catch (err) {
    console.error("Send invite error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send invites"
    });
  }
});

router.post("/api-early-access/send-invite-email", async (req, res) => {
  try {
    const { email, subject, html, text } = req.body;

    if (!email || !subject) {
      return res.status(400).json({
        success: false,
        message: "email and subject are required"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    if (!html && !text) {
      return res.status(400).json({
        success: false,
        message: "Either html or text body is required"
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        message: "Email service is not configured"
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const info = await transporter.sendMail({
      from: `"Dyad Practice Solutions" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to: email,
      subject,
      ...(html && { html }),
      ...(text && { text })
    });

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId
    });

  } catch (err) {
    console.error("Send invite email error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send email. Please try again later."
    });
  }
});

export default router;
