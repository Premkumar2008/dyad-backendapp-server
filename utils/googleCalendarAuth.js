import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar"];
const DEFAULT_KEY_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "routes",
  "service-account.json"
);

const buildGoogleAuth = () => {
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

let authClientPromise = null;

export const getGoogleAuth = () => {
  if (!authClientPromise) {
    authClientPromise = Promise.resolve(buildGoogleAuth());
  }
  return authClientPromise;
};

export const getCalendarClient = async () => {
  const auth = await getGoogleAuth();
  const client = await auth.getClient();
  return google.calendar({
    version: "v3",
    auth: client,
  });
};
