import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import registerRoute from "./routes/register.js";
import loginRoute from "./routes/login.js";
import profileRoute from "./routes/profile.js";
import refreshRoute from "./routes/refresh.js";
import verifyEmailRoute from "./routes/verifyEmail.js";
import sendEmailOtp from "./routes/sendEmailOtp.js";
import apiDocumentationRoute from "./routes/apiDocumentation.js";
import verifyOtpRoute from "./routes/verifyOtp.js";
import forgotPasswordRoute from "./routes/forgotPassword.js";
import contactRequestsRoute from "./routes/contactRequests.js";
import usersRoute from "./routes/users.js";
import recaptchaRoute from "./routes/recaptcha.js";
import calendarRoute from "./routes/calendar.js";
import npiRegistryRoute from "./routes/npiRegistry.js";
import calendlyWebhookRoute from "./routes/calendly-webhook.js";
import earlyAccessRoute from "./routes/earlyAccess.js";
import sendEmailRoute from "./routes/sendEmail.js";
import onboardingScheduleConfirmationRoute from "./routes/onboardingScheduleConfirmation.js";
import onboardingStepsRoute from "./routes/onboardingSteps.js";
import onboardingClientRoute from "./routes/onboardingClient.js";
import taxonomiesRoute from "./routes/taxonomies.js";
import adminLoginRoute from "./routes/adminLogin.js";
import callsScheduledAdminRoute from "./routes/callsScheduledAdmin.js";
import zohoPaymentsRoute from "./routes/zohoPayments.js";
import zohoCustomerRoute from "./routes/zohoCustomer.js";
import googleCalendarOAuthRoute from "./routes/googleCalendarOAuth.js";

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4200",
  "https://landing-dev.dyadmd.com",
  "https://dyadmd.com",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // For development, allow all origins
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-allow-origin']
}));

app.use(express.json({ limit: "25mb" }));

app.use("/api", registerRoute);
app.use("/api", loginRoute);
app.use("/api", profileRoute);
app.use("/api", refreshRoute);
app.use("/api", verifyEmailRoute);
app.use("/api", sendEmailOtp);
app.use("/api", apiDocumentationRoute);
app.use("/api", verifyOtpRoute);
app.use("/api", forgotPasswordRoute);
app.use("/api", contactRequestsRoute);
app.use("/api", usersRoute);
app.use("/api", recaptchaRoute);
app.use("/api", calendarRoute);
app.use("/api", npiRegistryRoute);
app.use("/api/calendly", calendlyWebhookRoute);
app.use("/api", earlyAccessRoute);
app.use("/api", sendEmailRoute);
app.use("/api", onboardingScheduleConfirmationRoute);
app.use("/api", onboardingStepsRoute);
app.use("/api", onboardingClientRoute);
app.use("/api", taxonomiesRoute);
app.use("/api", adminLoginRoute);
app.use("/api", callsScheduledAdminRoute);
app.use("/api", zohoPaymentsRoute);
app.use("/api", zohoCustomerRoute);
app.use("/api", googleCalendarOAuthRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});