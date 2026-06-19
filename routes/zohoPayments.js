import express from "express";
import {
  getAccessToken,
  getZohoAccountId,
  getZohoApiKey,
  getZohoPaymentsBaseUrl,
} from "../utils/zohoAuth.js";
import {
  ensureZohoSubscriptionsTable,
  getNextChargeDate,
  insertSubscription,
  getSubscriptionByCustomerId,
} from "../utils/zohoSubscriptionDb.js";
import { processDueSubscriptions } from "../utils/zohoRecurring.js";

const router = express.Router();

const extractPaymentSession = (data) =>
  data?.payment_session ||
  data?.payments_session ||
  data?.data?.payment_session ||
  data?.data?.payments_session ||
  null;

router.post("/create-session", async (req, res) => {
  try {
    const {
      amount,
      currency = "USD",
      description = "Dyad subscription payment",
      purpose = "subscription",
      customerId,
      plan,
      createMandate = true,
    } = req.body;

    if (amount === undefined || amount === null || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount is required and must be greater than 0",
      });
    }

    const accountId = getZohoAccountId();
    if (!accountId) {
      return res.status(500).json({
        success: false,
        message: "ZOHO_ACCOUNT_ID is not configured",
      });
    }

    const token = await getAccessToken();
    const paymentsBaseUrl = getZohoPaymentsBaseUrl();

    const metaData = [{ key: "purpose", value: purpose }];
    if (plan) {
      metaData.push({ key: "plan", value: String(plan) });
    }

    const sessionBody = {
      amount: Number(amount),
      currency,
      description,
      meta_data: metaData,
      configurations: {
        allowed_payment_methods: ["ach_debit"],
      },
    };

    if (customerId) {
      sessionBody.customer_id = customerId;
    }

    if (createMandate) {
      sessionBody.type = "mandate_enrollment";
      sessionBody.mandate_details = {
        payment_method_type: "ach_debit",
        frequency: plan === "yearly" ? "yearly" : "monthly",
        amount_rule: "fixed",
        description: description,
        debit_rule: "on",
        debit_day: Math.min(new Date().getUTCDate(), 28),
      };
    }

    const response = await fetch(
      `${paymentsBaseUrl}/paymentsessions?account_id=${accountId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionBody),
      }
    );

    const data = await response.json();
    const paymentSession = extractPaymentSession(data);

    if (!response.ok || !paymentSession?.payments_session_id) {
      console.error("Zoho create-session error:", data);
      return res.status(response.status || 500).json({
        success: false,
        message: "Failed to create Zoho payment session",
        error: data?.message || data?.error || data,
      });
    }

    res.status(201).json({
      success: true,
      session_id: paymentSession.payments_session_id,
      checkoutSession: paymentSession.payments_session_id,
      accessKey: paymentSession.access_key || null,
      apiKey: getZohoApiKey() || null,
      accountId,
      currency: paymentSession.currency || currency,
      amount: paymentSession.amount || amount,
      data: paymentSession,
    });
  } catch (error) {
    console.error("Create Zoho session error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment session",
      error: error.message,
    });
  }
});

router.post("/save-mandate", async (req, res) => {
  try {
    await ensureZohoSubscriptionsTable();

    const {
      payment_id,
      paymentId,
      customer_id,
      customerId,
      payment_method_id,
      paymentMethodId,
      mandate_id,
      mandateId,
      plan = "monthly",
      amount,
      currency = "USD",
    } = req.body;

    const zohoCustomerId = customer_id || customerId;
    const zohoPaymentMethodId = payment_method_id || paymentMethodId;
    const zohoPaymentId = payment_id || paymentId;
    const zohoMandateId = mandate_id || mandateId;

    if (!zohoCustomerId || !zohoPaymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "customer_id and payment_method_id are required",
      });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount is required and must be greater than 0",
      });
    }

    const normalizedPlan = plan === "yearly" ? "yearly" : "monthly";
    const nextCharge = getNextChargeDate(normalizedPlan);

    const existing = await getSubscriptionByCustomerId(zohoCustomerId);
    if (existing?.mandate_active) {
      return res.status(200).json({
        success: true,
        ok: true,
        message: "Mandate already saved for this customer",
        data: existing,
      });
    }

    const saved = await insertSubscription({
      zoho_customer_id: zohoCustomerId,
      zoho_payment_id: zohoPaymentId,
      zoho_payment_method_id: zohoPaymentMethodId,
      zoho_mandate_id: zohoMandateId,
      plan: normalizedPlan,
      amount: Number(amount),
      currency,
      next_charge: nextCharge,
    });

    res.status(201).json({
      success: true,
      ok: true,
      data: saved,
    });
  } catch (error) {
    console.error("Save mandate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save mandate",
      error: error.message,
    });
  }
});

router.get("/subscription/:customerId", async (req, res) => {
  try {
    await ensureZohoSubscriptionsTable();
    const subscription = await getSubscriptionByCustomerId(req.params.customerId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No subscription found for this customer",
      });
    }

    res.json({ success: true, data: subscription });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription",
      error: error.message,
    });
  }
});

router.post("/run-recurring-billing", async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET || process.env.ZOHO_CRON_SECRET;
    const provided = req.headers["x-cron-secret"] || req.body?.cronSecret;

    if (cronSecret && provided !== cronSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result = await processDueSubscriptions(new Date());
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Recurring billing error:", error);
    res.status(500).json({
      success: false,
      message: "Recurring billing failed",
      error: error.message,
    });
  }
});

export default router;
