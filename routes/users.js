import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { pool } from "../config/db.js";

const router = express.Router();

// Check if email exists
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    const result = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length > 0) {
      return res.status(200).json({
        success: true,
        exists: true,
        message: "Email exists"
      });
    } else {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "Email does not exist"
      });
    }

  } catch (err) {
    console.error("Check email error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to check email"
    });
  }
});

router.get("/users", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, first_name, last_name, email, npi, phone, role, email_verified, created_at FROM users ORDER BY created_at DESC"
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve users"
    });
  }
});

router.put("/users/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, npi, phone, role, email_verified } = req.body;

    // Validate that at least one field is provided
    if (!first_name && !last_name && !email && !npi && !phone && !role && email_verified === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one field must be provided for update"
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (first_name !== undefined) {
      updateFields.push(`first_name = $${paramIndex++}`);
      updateValues.push(first_name);
    }
    if (last_name !== undefined) {
      updateFields.push(`last_name = $${paramIndex++}`);
      updateValues.push(last_name);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      updateValues.push(email);
    }
    if (npi !== undefined) {
      updateFields.push(`npi = $${paramIndex++}`);
      updateValues.push(npi);
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      updateValues.push(phone);
    }
    if (role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`);
      updateValues.push(role);
    }
    if (email_verified !== undefined) {
      updateFields.push(`email_verified = $${paramIndex++}`);
      updateValues.push(email_verified);
    }

    // Add user ID as the last parameter
    updateValues.push(id);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${paramIndex}
      RETURNING id, first_name, last_name, email, npi, phone, role, email_verified, created_at, updated_at
    `;

    const result = await pool.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Update user error:", err);
    
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: "Email already exists"
      });
    }
    
    if (err.code === '23502') {
      return res.status(400).json({
        success: false,
        message: "Missing required field or invalid data"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update user"
    });
  }
});

export default router;
