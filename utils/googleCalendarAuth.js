import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];
const DEFAULT_KEY_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "routes",
  "service-account.json"
);

const PLACEHOLDER_REFRESH_TOKENS = new Set([
  "your_google_refresh_token_here",
  "your_refresh_token_here",
]);

export const hasValidGoogleRefreshToken = () => {
  const token = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  return Boolean(token && !PLACEHOLDER_REFRESH_TOKENS.has(token) && token.length > 20);
};

export const getCalendarAuthMode = () =>
  hasValidGoogleRefreshToken() ? "oauth_user" : "service_account";

export const getGoogleOAuthRedirectUri = () =>
  process.env.GOOGLE_REDIRECT_URI ||
  process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
  process.env.REDIRECT_URI;

const buildServiceAccountAuth = () => {
  const jsonFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonFromEnv) {
    const credentials = JSON.parse(jsonFromEnv);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: CALENDAR_SCOPES,
    });
  }

  const keyFile =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_KEY_FILE;

  if (!fs.existsSync(keyFile)) {
    throw new Error(
      `Google service account file not found at ${keyFile}. ` +
        "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in production."
    );
  }

  return new google.auth.GoogleAuth({
    keyFile,
    scopes: CALENDAR_SCOPES,
  });
};

export const createGoogleOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleOAuthRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI are required for OAuth calendar access."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const buildGoogleAuth = () => {
  if (hasValidGoogleRefreshToken()) {
    const oauth2Client = createGoogleOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    return oauth2Client;
  }

  return buildServiceAccountAuth();
};

let authClientPromise = null;

export const getGoogleAuth = () => {
  if (!authClientPromise) {
    authClientPromise = Promise.resolve(buildGoogleAuth());
  }
  return authClientPromise;
};

export const getCalendarClient = async () => {
  const auth = await getGoogleAuth();

  if (hasValidGoogleRefreshToken()) {
    return google.calendar({
      version: "v3",
      auth,
    });
  }

  const client = await auth.getClient();
  return google.calendar({
    version: "v3",
    auth: client,
  });
};
