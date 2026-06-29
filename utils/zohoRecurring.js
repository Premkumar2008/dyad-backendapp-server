import { zohoPost } from "./zohoClient.js";
import {
  findDueSubscriptions,
  getNextChargeDate,
  markSubscriptionCharged,
  markSubscriptionFailed,
} from "./zohoSubscriptionDb.js";
import { insertBillingEvent } from "./zohoBillingEventsDb.js";
import { insertPaymentRecord } from "./zohoPaymentsDb.js";

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

      const paymentRecord = await insertPaymentRecord({
        ownerId: subscription.owner_id,
        subscriptionId: subscription.id,
        zohoCustomerId: subscription.zoho_customer_id,
        zohoPaymentId: paymentId,
        zohoPaymentMethodId: subscription.zoho_payment_method_id,
        amount: subscription.amount,
        currency: subscription.currency || "USD",
        plan: subscription.plan,
        paymentType: "recurring",
        status: "succeeded",
        zohoStatus: payment.status || payment.payment_status || "succeeded",
        metadata: payment,
      });

      await insertBillingEvent({
        ownerId: subscription.owner_id,
        subscriptionId: subscription.id,
        paymentId: paymentRecord.id,
        eventType: "recurring_charge_succeeded",
        message: "Recurring subscription charge succeeded",
        payload: {
          zohoPaymentId: paymentId,
          nextCharge: updated.next_charge,
        },
      });

      results.push({
        subscriptionId: subscription.id,
        success: true,
        paymentId,
        nextCharge: updated.next_charge,
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : "Charge failed";

      await markSubscriptionFailed(subscription.id, failureReason);

      const paymentRecord = await insertPaymentRecord({
        ownerId: subscription.owner_id,
        subscriptionId: subscription.id,
        zohoCustomerId: subscription.zoho_customer_id,
        zohoPaymentMethodId: subscription.zoho_payment_method_id,
        amount: subscription.amount,
        currency: subscription.currency || "USD",
        plan: subscription.plan,
        paymentType: "recurring",
        status: "failed",
        failureReason,
        metadata: {
          source: "recurring-billing",
        },
      });

      await insertBillingEvent({
        ownerId: subscription.owner_id,
        subscriptionId: subscription.id,
        paymentId: paymentRecord.id,
        eventType: "recurring_charge_failed",
        message: failureReason,
        payload: {
          subscriptionId: subscription.id,
        },
      });

      results.push({
        subscriptionId: subscription.id,
        success: false,
        error: failureReason,
      });
    }
  }

  return { processed: results.length, results };
};
