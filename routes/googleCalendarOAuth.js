import express from "express";
import {
  createGoogleOAuthClient,
  getCalendarAuthMode,
  getGoogleOAuthRedirectUri,
  hasValidGoogleRefreshToken,
} from "../utils/googleCalendarAuth.js";

const router = express.Router();

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

router.get("/google-calendar/auth-url", (req, res) => {
  try {
    const oauth2Client = createGoogleOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: CALENDAR_SCOPES,
    });

    res.json({
      success: true,
      authUrl,
      redirectUri: getGoogleOAuthRedirectUri(),
      calendarEmailHint: process.env.EMAIL_USER_CALENDER || process.env.CALENDAR_ID,
      instructions: [
        "Open authUrl in a browser while signed in as the calendar owner account.",
        "Approve access, then copy the refresh_token from the callback response.",
        "Set GOOGLE_REFRESH_TOKEN in .env and restart the server.",
      ],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/google-calendar/oauth/callback", async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: String(error),
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Missing OAuth code",
      });
    }

    const oauth2Client = createGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(String(code));

    res.json({
      success: true,
      message:
        "Authorization successful. Copy refresh_token into GOOGLE_REFRESH_TOKEN in .env, then restart the server.",
      refresh_token: tokens.refresh_token || null,
      has_refresh_token: Boolean(tokens.refresh_token),
      access_token_expiry: tokens.expiry_date || null,
      authModeAfterRestart: tokens.refresh_token
        ? "oauth_user"
        : "service_account",
      currentAuthMode: getCalendarAuthMode(),
      currentlyConfigured: hasValidGoogleRefreshToken(),
    });
  } catch (err) {
    console.error("Google Calendar OAuth callback error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "OAuth callback failed",
    });
  }
});

router.get("/google-calendar/auth-status", (req, res) => {
  res.json({
    success: true,
    authMode: getCalendarAuthMode(),
    hasRefreshToken: hasValidGoogleRefreshToken(),
    calendarId:
      process.env.EMAIL_USER_CALENDER ||
      process.env.CALENDAR_ID ||
      "dyadcontactrequest@gmail.com",
    meetSupported:
      getCalendarAuthMode() === "oauth_user"
        ? true
        : "Requires OAuth user token for personal Gmail calendars",
  });
});

export default router;
