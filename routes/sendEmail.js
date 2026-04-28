import express from "express";
import nodemailer from "nodemailer";
import { pool } from "../config/db.js";

const router = express.Router();

router.post("/send-email/sendgrid", async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        message: "to and subject are required"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid recipient email address"
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
        message: "Email service is not configured. Please contact support."
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      ...(html && { html }),
      ...(text && { text })
    };

    let emailSent = false;
    let messageId = null;

    try {
      const info = await transporter.sendMail(mailOptions);
      emailSent = true;
      messageId = info.messageId;
    } catch (emailErr) {
      console.error("Send email error:", emailErr);
      emailSent = false;
    }

    // Update send_email_confirm on the matching early access record
    await pool.query(
      `UPDATE early_access_requests
       SET send_email_confirm = $1, updated_at = CURRENT_TIMESTAMP
       WHERE email = $2`,
      [emailSent, to.toLowerCase().trim()]
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send email. Please try again later."
      });
    }

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId
    });

  } catch (err) {
    console.error("Send email error:", err);

    if (err.code === "EAUTH") {
      return res.status(500).json({
        success: false,
        message: "Email authentication failed. Please contact support."
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to send email. Please try again later."
    });
  }
});

export default router;
