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
import { insertBillingEvent, findBillingEventsByOwnerId } from "../utils/zohoBillingEventsDb.js";
import {
  findPaymentsByOwnerId,
  insertPaymentRecord,
  isZohoPaymentSuccessful,
  mapZohoPaymentStatus,
} from "../utils/zohoPaymentsDb.js";
import {
  findPaymentSessionsByOwnerId,
  insertPaymentSession,
  updatePaymentSessionStatus,
} from "../utils/zohoPaymentSessionsDb.js";

const router = express.Router();

const normalizePlan = (plan) => (plan === "yearly" ? "yearly" : "monthly");

const resolveOwnerId = (body) => body.userId || body.onboardingId || body.ownerId || null;

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
    const ownerId = resolveOwnerId(req.body);

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
        ...(ownerId ? [{ key: "owner_id", value: String(ownerId) }] : []),
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
    const zohoSessionId =
      paymentsSession?.payments_session_id || session_id || payments_session_id;

    if (zohoSessionId) {
      await insertPaymentSession({
        ownerId,
        zohoCustomerId,
        sessionType: "payment",
        zohoSessionId,
        amount: Number(amount),
        currency,
        plan: normalizedPlan,
        metadata: { source: "create-session" },
      });

      if (ownerId) {
        await insertBillingEvent({
          ownerId,
          eventType: "payment_session_created",
          message: "Zoho payment session created",
          payload: {
            zohoSessionId,
            amount: Number(amount),
            currency,
            plan: normalizedPlan,
          },
        });
      }
    }

    res.json({
      session_id: zohoSessionId,
      payments_session_id: zohoSessionId,
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
    const {
      payment_id,
      paymentId,
      userId,
      onboardingId,
      session_id,
      payments_session_id,
      plan,
      amount,
      currency = "USD",
    } = req.body;

    const zohoPaymentId = payment_id || paymentId;
    const ownerId = resolveOwnerId(req.body);
    const zohoSessionId = session_id || payments_session_id || null;

    if (!zohoPaymentId) {
      return res.status(400).json({ error: "payment_id is required" });
    }

    const data = await zohoGet(`/payments/${zohoPaymentId}`);
    const payment = extractPayment(data);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const zohoStatus = payment.status || payment.payment_status;
    const success = isZohoPaymentSuccessful(zohoStatus);
    const mappedStatus = success ? "succeeded" : mapZohoPaymentStatus(zohoStatus);
    const subscription = ownerId ? await findSubscriptionByOwnerId(ownerId) : null;

    const paymentRecord = await insertPaymentRecord({
      ownerId,
      subscriptionId: subscription?.id,
      zohoCustomerId: payment.customer_id,
      zohoPaymentId: payment.payment_id || zohoPaymentId,
      zohoPaymentMethodId: resolvePaymentMethodId(payment),
      zohoSessionId,
      amount: payment.amount ?? amount ?? null,
      currency: payment.currency || currency,
      plan: plan ? normalizePlan(plan) : subscription?.plan || null,
      paymentType: "verification",
      status: mappedStatus,
      failureReason: success ? null : `Zoho payment status: ${zohoStatus}`,
      zohoStatus,
      metadata: payment,
    });

    if (zohoSessionId) {
      await updatePaymentSessionStatus(zohoSessionId, {
        status: success ? "completed" : "failed",
        failureReason: success ? null : `Zoho payment status: ${zohoStatus}`,
        metadata: { payment_id: zohoPaymentId },
      });
    }

    if (ownerId) {
      await insertBillingEvent({
        ownerId,
        subscriptionId: subscription?.id,
        paymentId: paymentRecord.id,
        eventType: success ? "payment_verified_success" : "payment_verified_failed",
        message: success
          ? "Payment verified successfully"
          : `Payment verification failed with status ${zohoStatus}`,
        payload: {
          zohoPaymentId: payment.payment_id || zohoPaymentId,
          zohoStatus,
        },
      });
    }

    res.json({
      success,
      payment_id: payment.payment_id || zohoPaymentId,
      status: zohoStatus,
      customer_id: payment.customer_id,
      payment_method_id: resolvePaymentMethodId(payment),
      amount: payment.amount,
      currency: payment.currency,
      local_payment_id: paymentRecord.id,
      data: payment,
    });
  } catch (err) {
    handleZohoError(res, err, "verify-payment failed");
  }
});

router.post("/create-payment-method-session", async (req, res) => {
  try {
    const { customerId, customer_id, description, userId, onboardingId } = req.body;
    const zohoCustomerId = customerId || customer_id;
    const ownerId = resolveOwnerId(req.body);

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

    await insertPaymentSession({
      ownerId,
      zohoCustomerId,
      sessionType: "payment_method",
      zohoSessionId: session.payment_method_session_id,
      metadata: { source: "create-payment-method-session" },
    });

    if (ownerId) {
      await insertBillingEvent({
        ownerId,
        eventType: "payment_method_session_created",
        message: "Zoho payment method session created",
        payload: {
          paymentMethodSessionId: session.payment_method_session_id,
        },
      });
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
      session_id,
      payments_session_id,
    } = req.body;

    const ownerId = resolveOwnerId(req.body);
    const zohoCustomerId = customer_id || customerId;
    const zohoPaymentId = payment_id || paymentId;
    let zohoPaymentMethodId = payment_method_id || paymentMethodId;
    const zohoSessionId = session_id || payments_session_id || null;

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

    const paymentRecord = await insertPaymentRecord({
      ownerId,
      subscriptionId: saved.id,
      zohoCustomerId,
      zohoPaymentId,
      zohoPaymentMethodId,
      zohoSessionId,
      amount: Number(amount),
      currency,
      plan: normalizedPlan,
      paymentType: "initial",
      status: "succeeded",
      zohoStatus: "succeeded",
      metadata: { source: "save-subscription" },
    });

    if (zohoSessionId) {
      await updatePaymentSessionStatus(zohoSessionId, {
        status: "completed",
        metadata: { subscription_id: saved.id, payment_id: zohoPaymentId },
      });
    }

    await insertBillingEvent({
      ownerId,
      subscriptionId: saved.id,
      paymentId: paymentRecord.id,
      eventType: "subscription_created",
      message: "Subscription saved after successful payment",
      payload: {
        plan: normalizedPlan,
        amount: Number(amount),
        currency,
        zohoPaymentId,
      },
    });

    res.status(201).json({
      success: true,
      isNew: true,
      data: saved,
      payment: paymentRecord,
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

router.get("/payments/:ownerId", async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const payments = await findPaymentsByOwnerId(req.params.ownerId, {
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });

    res.json({ success: true, total: payments.length, data: payments });
  } catch (err) {
    console.error("get payments failed:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.get("/payment-sessions/:ownerId", async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const sessions = await findPaymentSessionsByOwnerId(req.params.ownerId, {
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });

    res.json({ success: true, total: sessions.length, data: sessions });
  } catch (err) {
    console.error("get payment sessions failed:", err);
    res.status(500).json({ error: "Failed to fetch payment sessions" });
  }
});

router.get("/billing-events/:ownerId", async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const events = await findBillingEventsByOwnerId(req.params.ownerId, {
      limit: Number(limit) || 100,
      offset: Number(offset) || 0,
    });

    res.json({ success: true, total: events.length, data: events });
  } catch (err) {
    console.error("get billing events failed:", err);
    res.status(500).json({ error: "Failed to fetch billing events" });
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
