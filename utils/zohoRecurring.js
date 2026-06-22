import { zohoPost } from "./zohoClient.js";
import {
  findDueSubscriptions,
  getNextChargeDate,
  markSubscriptionCharged,
  markSubscriptionFailed,
} from "./zohoSubscriptionDb.js";

const extractPayment = (data) => data?.payment || data?.data?.payment || null;

export const chargeSubscription = async (subscription) => {
  const data = await zohoPost("/payments", {
    amount: Number(subscription.amount),
    currency: subscription.currency || "USD",
    customer_id: subscription.zoho_customer_id,
    payment_method_id: subscription.zoho_payment_method_id,
    customer_on_session: false,
    description: `Recurring ${subscription.plan} subscription`,
    statement_descriptor: "DYAD SUBSCRIPTION",
    meta_data: [
      { key: "subscription_id", value: String(subscription.id) },
      { key: "plan", value: subscription.plan },
    ],
  });

  const payment = extractPayment(data);
  if (!payment) {
    throw new Error("Charge failed");
  }
  return payment;
};

export const processDueSubscriptions = async (asOf = new Date()) => {
  const due = await findDueSubscriptions(asOf);
  const results = [];

  for (const subscription of due) {
    try {
      const payment = await chargeSubscription(subscription);
      const paymentId = payment.payment_id || payment.id || null;
      const updated = await markSubscriptionCharged(subscription.id, {
        paymentId,
        nextCharge: getNextChargeDate(subscription.plan, asOf),
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
