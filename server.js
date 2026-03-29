import express from "express";
import dotenv from "dotenv";
import cors from "cors";
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

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://landing-dev.dyadmd.com',
      'https://www.landing-dev.dyadmd.com',
      // Add your deployed frontend domain here
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Total-Count']
};

app.use(cors(corsOptions));
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

app.listen(5000, () => {
  console.log("Server running on port 5000");
});