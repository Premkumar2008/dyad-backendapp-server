const dataCenterUrls = {
  us: {
    accounts: "https://accounts.zoho.com",
    payments: "https://payments.zoho.com/api/v1",
  },
  in: {
    accounts: "https://accounts.zoho.in",
    payments: "https://payments.zoho.in/api/v1",
  },
  eu: {
    accounts: "https://accounts.zoho.eu",
    payments: "https://payments.zoho.eu/api/v1",
  },
};

const getZohoUrls = () => {
  const dc = (process.env.ZOHO_DATA_CENTER || "us").toLowerCase();
  return dataCenterUrls[dc] || dataCenterUrls.us;
};

let cachedAccessToken = null;
let tokenExpiresAt = 0;

export const getAccessToken = async () => {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  console.log("testttt:::", refreshToken, clientId, clientSecret);

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(
      "ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, and ZOHO_CLIENT_SECRET must be set"
    );
  }

  const { accounts } = getZohoUrls();
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(data.error || data.message || "Failed to obtain Zoho access token");
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  console.log("cachedAccessToken:::", data, cachedAccessToken);

  return cachedAccessToken;
};

export const getZohoPaymentsBaseUrl = () => getZohoUrls().payments;

export const getZohoAccountId = () =>
  process.env.ZOHO_ACCOUNT_ID || process.env.ZOHO_PAYMENTS_ACCOUNT_ID || "";

export const getZohoApiKey = () =>
  process.env.ZOHO_API_KEY || process.env.ZOHO_PAYMENTS_API_KEY || "";
