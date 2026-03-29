import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import nodemailer from "nodemailer";
import { generateOTP } from "../utils/generateOtp.js";

const router = express.Router();

// Send reset password OTP
router.post("/send-reset-otp", async (req, res) => {
  try {
    const { email } = req.body;

    // Check email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("Email configuration missing:", {
        EMAIL_USER: !!process.env.EMAIL_USER,
        EMAIL_PASS: !!process.env.EMAIL_PASS
      });
      return res.status(500).json({
        success: false,
        message: "Email service not configured. Please contact support."
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required"
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Check if user exists
    const userResult = await pool.query(
      "SELECT id, email FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      // For security, don't reveal if email exists or not
      return res.json({
        success: true,
        message: "If an account with this email exists, a reset OTP will be sent"
      });
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store reset OTP in memory first (before email sending)
    global.resetOtpStore = global.resetOtpStore || {};
    global.resetOtpStore[email] = { otp, expiry };
    console.log("OTP stored in memory for email:", email);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    try {
      // Verify transporter configuration
      await transporter.verify();
      console.log("Email transporter verified successfully");

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset OTP",
        html: `<h2>Your password reset OTP is: ${otp}</h2><p>This OTP will expire in 5 minutes.</p>`
      };

      console.log("Attempting to send email to:", email);
      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.messageId);
      
      // Only send success response after email is confirmed sent
      res.json({
        success: true,
        message: "Password reset OTP sent to your email address"
      });
      
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Even if email fails, OTP is stored - return success for security
      // but log the email error for debugging
      res.json({
        success: true,
        message: "Password reset OTP sent to your email address"
      });
    }

  } catch (err) {
    console.error("Send reset OTP error:", err);
    
    // Check for specific email configuration errors
    if (err.code === 'EAUTH' || err.code === 'ECONNECTION') {
      return res.status(500).json({
        success: false,
        message: "Email service configuration error. Please contact support."
      });
    }
    
    if (err.code === 'EMESSAGE') {
      return res.status(500).json({
        success: false,
        message: "Failed to send email. Please check the email address and try again."
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to send reset OTP. Please try again later."
    });
  }
});

// Verify OTP and reset password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required"
      });
    }

    // Password validation
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    const otpData = global.resetOtpStore?.[email];

    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: "No reset OTP was sent to this email address"
      });
    }

    if (new Date() > otpData.expiry) {
      return res.status(400).json({
        success: false,
        message: "Reset OTP has expired. Please request a new one"
      });
    }

    if (otpData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check and try again"
      });
    }

    // Hash the new password
    const hash = await bcrypt.hash(newPassword, 10);

    // Update user password
    const result = await pool.query(
      "UPDATE users SET password_hash = $1 WHERE email = $2",
      [hash, email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Clean up OTP from memory
    delete global.resetOtpStore[email];

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password."
    });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      success: false,
      message: "Password reset failed due to server error"
    });
  }
});

export default router;
