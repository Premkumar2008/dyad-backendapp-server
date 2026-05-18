import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/taxonomies", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT taxonomy_code FROM provider_taxonomies ORDER BY category, subcategory, description`
    );

    res.status(200).json({
      success: true,
      total: result.rows.length,
      data: result.rows.map((row) => row.taxonomy_code)
    });

  } catch (err) {
    console.error("Taxonomies fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch taxonomies"
    });
  }
});

export default router;
