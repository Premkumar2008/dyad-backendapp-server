import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT id, first_name, last_name, email, npi, phone, role FROM users WHERE id=$1",
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User profile not found"
      });
    }

    res.json({
      success: true,
      data: user.rows[0]
    });

  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile information"
    });
  }
});

export default router;