import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT id, email, password_hash, email_verified, role FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    if(!user.email_verified){
 return res.status(403).json({
  success: false,
  message:"Please verify your email first before logging in"
 });
}

  const accessToken = jwt.sign(
 { id: user.id },
 process.env.JWT_SECRET,
 { expiresIn: "15m" }
);

const refreshToken = jwt.sign(
 { id: user.id },
 process.env.JWT_REFRESH_SECRET,
 { expiresIn: "7d" }
);
    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'user'
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      success: false,
      message: "Login failed due to server error. Please try again later." 
    });
  }
});

export default router;