import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/npi/registry", async (req, res) => {
  try {
    const { npi } = req.body;

    if (!npi || !/^\d{10}$/.test(String(npi))) {
      return res.status(400).json({
        success: false,
        message: "NPI must be a 10-digit number",
      });
    }

    const response = await axios.get(
      `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`
    );

    const data = response.data;

    if (!data || !data.results || data.results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invalid NPI number",
      });
    }

    const result = data.results[0];

    const provider = {
      npi: result.number,
      enumeration_type: result.enumeration_type,
      basic: result.basic || {},
      addresses: result.addresses || [],
      taxonomies: result.taxonomies || [],
      identifiers: result.identifiers || [],
      other_names: result.other_names || [],
    };

    return res.status(200).json({
      success: true,
      message: "NPI provider found",
      data: provider,
    });
  } catch (err) {
    console.error("NPI Registry error:", err.message);

    // External API returned an error or no data
    if (err.response && err.response.status === 400) {
      return res.status(404).json({
        success: false,
        message: "Invalid NPI number",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch NPI data",
    });
  }
});

export default router;
