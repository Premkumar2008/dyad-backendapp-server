import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    const otpData = global.otpStore?.[email];

    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: "No OTP was sent to this email address"
      });
    }

    if (new Date() > otpData.expiry) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one"
      });
    }

    if (otpData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check and try again"
      });
    }

    // Update user's email_verified status to true
    await pool.query(
      `UPDATE users 
       SET email_verified = true 
       WHERE email = $1`,
      [email]
    );

    // Clean up OTP from memory
    delete global.otpStore[email];

    res.json({
      success: true,
      message: "OTP verified successfully"
    });

  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).json({
      success: false,
      message: "OTP verification failed due to server error"
    });
  }
});

export default router;
