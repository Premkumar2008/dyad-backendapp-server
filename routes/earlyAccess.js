import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

const VALID_PRACTICE_TYPES = [
  "Independent Practice",
  "Group Practice",
  "Hospital / Health System",
  "Urgent Care",
  "Specialty Clinic",
  "Federally Qualified Health Center (FQHC)",
  "Ambulatory Surgery Center (ASC)",
  "Other"
];

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

export default router;
