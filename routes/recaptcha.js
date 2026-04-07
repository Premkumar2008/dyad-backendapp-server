import express from "express";
import { verifyRecaptcha } from "../middleware/recaptcha.js";

const router = express.Router();

// Test reCAPTCHA verification
router.post("/verify-recaptcha", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA token is required"
      });
    }

    const result = await verifyRecaptcha(token, req.ip);

    res.json({
      success: result.success,
      message: result.message,
      errorCodes: result.errorCodes || []
    });

  } catch (error) {
    console.error("reCAPTCHA test error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify reCAPTCHA"
    });
  }
});

export default router;
