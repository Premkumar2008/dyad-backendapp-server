import {
  getAccessToken,
  getZohoAccountId,
  getZohoPaymentsBaseUrl,
} from "./zohoAuth.js";
import {
  findDueSubscriptions,
  getNextChargeDate,
  markSubscriptionCharged,
  markSubscriptionFailed,
} from "./zohoSubscriptionDb.js";

const extractPayment = (data) =>
  data?.payment || data?.data?.payment || data;

export const chargeRecurring = async (subscription) => {
  const token = await getAccessToken();
  const accountId = getZohoAccountId();
  const paymentsBaseUrl = getZohoPaymentsBaseUrl();

  if (!accountId) {
    throw new Error("ZOHO_ACCOUNT_ID is not configured");
  }

  const body = {
    amount: Number(subscription.amount),
    currency: subscription.currency || "USD",
    customer_id: subscription.zoho_customer_id,
    payment_method_id: subscription.zoho_payment_method_id,
    customer_on_session: false,
    description: `Recurring ${subscription.plan} subscription charge`,
    statement_descriptor: "DYAD SUBSCRIPTION",
    meta_data: [
      { key: "subscription_id", value: String(subscription.id) },
      { key: "plan", value: subscription.plan },
    ],
  };

  const response = await fetch(
    `${paymentsBaseUrl}/payments?account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();
  const payment = extractPayment(data);

  if (!response.ok) {
    const message =
      data?.message || data?.error || payment?.failure_reason || "Charge failed";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return payment || data;
};

export const processDueSubscriptions = async (asOf = new Date()) => {
  const due = await findDueSubscriptions(asOf);
  const results = [];

  for (const subscription of due) {
    try {
      const payment = await chargeRecurring(subscription);
      const paymentId =
        payment?.payment_id || payment?.id || payment?.payments_id || null;
      const nextCharge = getNextChargeDate(subscription.plan, asOf);

      const updated = await markSubscriptionCharged(subscription.id, {
        paymentId,
        nextCharge,
      });

      results.push({
        subscriptionId: subscription.id,
        success: true,
        paymentId,
        nextCharge: updated.next_charge,
      });
    } catch (error) {
      await markSubscriptionFailed(
        subscription.id,
        error instanceof Error ? error.message : "Charge failed"
      );

      results.push({
        subscriptionId: subscription.id,
        success: false,
        error: error instanceof Error ? error.message : "Charge failed",
      });
    }
  }

  return { processed: results.length, results };
};
