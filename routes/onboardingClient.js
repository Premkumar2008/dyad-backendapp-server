import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.post("/onboarding-client/check-npi", async (req, res) => {
  try {
    const { npi } = req.body;

    if (!npi) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "NPI number is required",
      });
    }

    const npiDigits = String(npi).replace(/\D/g, "");
    if (npiDigits.length !== 10) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "NPI must be exactly 10 digits",
      });
    }

    const result = await pool.query(
      `
        SELECT onboarding_id, status, created_at, updated_at
        FROM onboarding_steps
        WHERE npi = $1
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      [npiDigits]
    );

    if (result.rows.length > 0) {
      const { onboarding_id, status, created_at, updated_at } = result.rows[0];
      return res.status(200).json({
        success: true,
        exists: true,
        onboardingId: onboarding_id,
        status,
        message: `An onboarding record with this NPI already exists (status: ${status}).`,
        submittedAt: created_at,
        updatedAt: updated_at,
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      onboardingId: null,
      message: "This NPI is not yet registered. You can continue onboarding.",
    });
  } catch (err) {
    console.error("Onboarding client check-npi error:", err);
    res.status(500).json({
      success: false,
      exists: null,
      message: "Unable to verify NPI at this time. Please try again later.",
    });
  }
});

export default router;
