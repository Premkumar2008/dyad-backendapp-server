import axios from "axios";

const API_BASE = "https://payments.zoho.com/api/v1";
const ACCOUNTS_URL = "https://accounts.zoho.com/oauth/v2/token";

let cachedToken = null;
let tokenExpiry = 0;

export async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(
      "ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, and ZOHO_CLIENT_SECRET must be set"
    );
  }

  const { data } = await axios.post(ACCOUNTS_URL, null, {
    params: {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    },
  });

  if (!data.access_token) {
    throw new Error(data.error || data.message || "Failed to obtain Zoho access token");
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;

  if (!data.scope?.includes("ZohoPay.payments.CREATE")) {
    console.warn(
      "Zoho token missing ZohoPay.payments.CREATE scope:",
      data.scope
    );
  }

  if (!data.scope?.includes("ZohoPay.customers.CREATE")) {
    console.warn(
      "Zoho token missing ZohoPay.customers.CREATE scope:",
      data.scope
    );
  }

  return cachedToken;
}

export { API_BASE };

export const getAccountId = () =>
  process.env.ZOHO_PAYMENTS_ACCOUNT_ID || process.env.ZOHO_ACCOUNT_ID || "";

export const getApiKey = () =>
  process.env.ZOHO_API_KEY || process.env.ZOHO_PAYMENTS_API_KEY || "";
