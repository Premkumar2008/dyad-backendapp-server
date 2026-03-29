import express from "express";

const router = express.Router();

// Simple test endpoint
router.get("/test", (req, res) => {
  console.log("Test endpoint called");
  res.json({
    success: true,
    message: "Server is working correctly",
    timestamp: new Date().toISOString()
  });
});

// Test environment variables
router.get("/test-env", (req, res) => {
  console.log("Environment test endpoint called");
  res.json({
    success: true,
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    emailUser: process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 3) + "***" : null,
    timestamp: new Date().toISOString()
  });
});

export default router;
