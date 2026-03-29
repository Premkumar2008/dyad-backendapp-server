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
import testRoute from "./routes/test.js";
import contactRequestsRoute from "./routes/contactRequests.js";

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
    return callback(null, true); // Allow all origins for now; restrict later
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use("/api", profileRoute);
app.use("/api", registerRoute);
app.use("/api", loginRoute);
app.use("/api", refreshRoute);
app.use("/api", verifyEmailRoute);
app.use("/api", sendEmailOtp);
app.use("/api", apiDocumentationRoute);
app.use("/api", verifyOtpRoute);
app.use("/api", forgotPasswordRoute);
app.use("/api", testRoute);
app.use("/api", contactRequestsRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});