import express from "express";
import axios from "axios";
import { API_BASE, getAccessToken, getAccountId, getApiKey } from "../utils/zohoAuth.js";

const router = express.Router();

router.post("/create-session", async (req, res) => {
  try {
    const token = await getAccessToken();
    const accountId = getAccountId();

    if (!accountId) {
      return res.status(500).json({ error: "ZOHO_ACCOUNT_ID is not configured" });
    }

    const {
      amount,
      currency = "USD",
      customerId,
      customer_id,
      plan = "monthly",
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "amount is required and must be greater than 0" });
    }

    const zohoCustomerId = customerId || customer_id;
    const normalizedPlan = plan === "yearly" ? "yearly" : "monthly";

    if (!zohoCustomerId) {
      return res.status(400).json({
        error: "customerId is required. Create a customer first via POST /api/customer",
      });
    }

    const body = {
      amount: Number(amount),
      currency,
      customer_id: zohoCustomerId,
      meta_data: [
        { key: "flow", value: "recurring_ach" },
        { key: "plan", value: normalizedPlan },
      ],
      configurations: {
        allowed_payment_methods: ["ach_debit"],
      },
    };

    const response = await axios.post(
      `${API_BASE}/paymentsessions?account_id=${accountId}`,
      body,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentsSession = response.data?.payments_session;

    res.json({
      session_id: paymentsSession?.payments_session_id,
      payments_session_id: paymentsSession?.payments_session_id,
      customer_id: zohoCustomerId,
      account_id: accountId,
      api_key: getApiKey(),
      plan: normalizedPlan,
      amount: Number(amount),
      currency,
    });
  } catch (err) {
    console.error("create-session failed:", err.response?.status, err.response?.data);

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
              "Your token likely lacks ZohoPay.payments.CREATE. Regenerate ORG OAuth with scopes: ZohoPay.payments.CREATE,ZohoPay.payments.READ,ZohoPay.customers.CREATE,ZohoPay.customers.READ",
          }
        : err.response?.data || { error: "session error" }
    );
  }
});

export default router;
