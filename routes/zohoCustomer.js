import express from "express";
import { zohoPost } from "../utils/zohoClient.js";
import { findByUserId, insertCustomer } from "../utils/zohoCustomersDb.js";

const router = express.Router();

router.post("/customer", async (req, res) => {
  try {
    const { name, email, phone, userId, onboardingId } = req.body;
    const ownerId = userId || onboardingId;

    if (!name || !email) {
      return res.status(400).json({ error: "name and email are required" });
    }

    if (!ownerId) {
      return res.status(400).json({ error: "userId or onboardingId is required" });
    }

    const existing = await findByUserId(ownerId);
    if (existing) {
      return res.json({
        customerId: existing.zoho_customer_id,
        isNew: false,
      });
    }

    const zohoBody = { name, email };
    if (phone) {
      zohoBody.phone = String(phone);
    }

    const data = await zohoPost("/customers", zohoBody);
    const zohoCustomerId = data?.customer?.customer_id;

    if (!zohoCustomerId) {
      return res.status(500).json({ error: "Failed to create Zoho customer" });
    }

    await insertCustomer({
      userId: ownerId,
      zohoCustomerId,
      name,
      email,
      phone: phone || null,
    });

    res.json({
      customerId: zohoCustomerId,
      isNew: true,
    });
  } catch (err) {
    console.error("customer error:", err.response?.status, err.response?.data);

    const zohoMessage = err.response?.data?.message;
    const isAuthError =
      err.response?.status === 401 ||
      (typeof zohoMessage === "string" &&
        zohoMessage.toLowerCase().includes("not an authorized user"));

    res.status(err.response?.status || 500).json(
      isAuthError
        ? {
            error: zohoMessage || "Not An Authorized User",
            hint:
              "Regenerate ORG OAuth using Server-based client with soid=zohopay.926398629 and scopes ZohoPay.customers.CREATE,ZohoPay.customers.READ,ZohoPay.payments.CREATE,ZohoPay.payments.READ. Current token likely only has payments.READ or was not linked to your Payments account.",
          }
        : err.response?.data || { error: "customer error" }
    );
  }
});

export default router;
