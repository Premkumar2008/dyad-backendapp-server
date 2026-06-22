import express from "express";
import axios from "axios";
import { API_BASE, getAccessToken, getAccountId, getApiKey } from "../utils/zohoAuth.js";
import { zohoGet, zohoPost } from "../utils/zohoClient.js";
import {
  findSubscriptionByOwnerId,
  getNextChargeDate,
  insertSubscription,
} from "../utils/zohoSubscriptionDb.js";
import { processDueSubscriptions } from "../utils/zohoRecurring.js";

const router = express.Router();

const normalizePlan = (plan) => (plan === "yearly" ? "yearly" : "monthly");

const extractPayment = (data) => data?.payment || data?.data?.payment || null;

const resolvePaymentMethodId = (payment, paymentMethodId) => {
  if (paymentMethodId) return paymentMethodId;
  return (
    payment?.payment_method_id ||
    payment?.payment_method?.payment_method_id ||
    payment?.payment_method?.id ||
    null
  );
};

const handleZohoError = (res, err, fallbackMessage) => {
  console.error(fallbackMessage, err.response?.status, err.response?.data);
  const zohoMessage = err.response?.data?.message;
  const isAuthError =
    err.response?.status === 401 ||
    (typeof zohoMessage === "string" &&
      zohoMessage.toLowerCase().includes("not an authorized user"));

  res.status(err.response?.status || 500).json(
    isAuthError
      ? {
          error: zohoMessage || "Not An Authorized User",
          hint: "Regenerate ORG OAuth with ZohoPay.payments.CREATE,ZohoPay.payments.READ,ZohoPay.customers.CREATE,ZohoPay.paymentmethods.CREATE scopes.",
        }
      : err.response?.data || { error: fallbackMessage }
  );
};

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
    const normalizedPlan = normalizePlan(plan);

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
    handleZohoError(res, err, "create-session failed");
  }
});

router.post("/verify-payment", async (req, res) => {
  try {
    const { payment_id, paymentId } = req.body;
    const zohoPaymentId = payment_id || paymentId;

    if (!zohoPaymentId) {
      return res.status(400).json({ error: "payment_id is required" });
    }

    const data = await zohoGet(`/payments/${zohoPaymentId}`);
    const payment = extractPayment(data);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const status = payment.status || payment.payment_status;
    const successStatuses = ["succeeded", "success", "paid", "captured"];

    res.json({
      success: successStatuses.includes(String(status).toLowerCase()),
      payment_id: payment.payment_id || zohoPaymentId,
      status,
      customer_id: payment.customer_id,
      payment_method_id: resolvePaymentMethodId(payment),
      amount: payment.amount,
      currency: payment.currency,
      data: payment,
    });
  } catch (err) {
    handleZohoError(res, err, "verify-payment failed");
  }
});

router.post("/create-payment-method-session", async (req, res) => {
  try {
    const { customerId, customer_id, description } = req.body;
    const zohoCustomerId = customerId || customer_id;

    if (!zohoCustomerId) {
      return res.status(400).json({ error: "customerId is required" });
    }

    const data = await zohoPost("/paymentmethodsessions", {
      customer_id: zohoCustomerId,
      description: description || "Save ACH for recurring subscription",
    });

    const session = data?.payment_method_session;
    if (!session?.payment_method_session_id) {
      return res.status(500).json({ error: "Failed to create payment method session" });
    }

    res.json({
      payment_method_session_id: session.payment_method_session_id,
      customer_id: zohoCustomerId,
      account_id: getAccountId(),
      api_key: getApiKey(),
      widget: {
        payment_method: "ach_debit",
        transaction_type: "add",
        customer_id: zohoCustomerId,
        payment_method_session_id: session.payment_method_session_id,
      },
    });
  } catch (err) {
    handleZohoError(res, err, "create-payment-method-session failed");
  }
});

router.post("/save-subscription", async (req, res) => {
  try {
    const {
      payment_id,
      paymentId,
      payment_method_id,
      paymentMethodId,
      customer_id,
      customerId,
      userId,
      onboardingId,
      plan = "monthly",
      amount,
      currency = "USD",
    } = req.body;

    const ownerId = userId || onboardingId;
    const zohoCustomerId = customer_id || customerId;
    const zohoPaymentId = payment_id || paymentId;
    let zohoPaymentMethodId = payment_method_id || paymentMethodId;

    if (!ownerId) {
      return res.status(400).json({ error: "userId or onboardingId is required" });
    }

    if (!zohoCustomerId) {
      return res.status(400).json({ error: "customerId is required" });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "amount is required and must be greater than 0" });
    }

    const existing = await findSubscriptionByOwnerId(ownerId);
    if (existing) {
      return res.json({
        success: true,
        isNew: false,
        data: existing,
      });
    }

    if (!zohoPaymentMethodId && zohoPaymentId) {
      const data = await zohoGet(`/payments/${zohoPaymentId}`);
      const payment = extractPayment(data);
      zohoPaymentMethodId = resolvePaymentMethodId(payment);
    }

    if (!zohoPaymentMethodId) {
      return res.status(400).json({
        error: "payment_method_id is required (or provide payment_id to resolve it)",
      });
    }

    const normalizedPlan = normalizePlan(plan);
    const saved = await insertSubscription({
      ownerId,
      zohoCustomerId,
      zohoPaymentId,
      zohoPaymentMethodId,
      plan: normalizedPlan,
      amount: Number(amount),
      currency,
      nextCharge: getNextChargeDate(normalizedPlan),
    });

    res.status(201).json({
      success: true,
      isNew: true,
      data: saved,
    });
  } catch (err) {
    handleZohoError(res, err, "save-subscription failed");
  }
});

router.get("/subscription/:ownerId", async (req, res) => {
  try {
    const subscription = await findSubscriptionByOwnerId(req.params.ownerId);

    if (!subscription) {
      return res.status(404).json({ error: "No subscription found" });
    }

    res.json({ success: true, data: subscription });
  } catch (err) {
    console.error("get subscription failed:", err);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

router.post("/run-recurring-billing", async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET || process.env.ZOHO_CRON_SECRET;
    const provided = req.headers["x-cron-secret"] || req.body?.cronSecret;

    if (cronSecret && provided !== cronSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await processDueSubscriptions(new Date());
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("recurring billing failed:", err);
    res.status(500).json({ error: "Recurring billing failed" });
  }
});

export default router;
