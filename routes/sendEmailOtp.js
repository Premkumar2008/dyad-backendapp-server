import express from "express";
import nodemailer from "nodemailer";
import { generateOTP } from "../utils/generateOtp.js";

const router = express.Router();

router.post("/send-email-otp", async (req,res)=>{
  try{
    const { email } = req.body;

    if(!email){
      return res.status(400).json({
        success: false,
        message:"Email address is required"
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return res.status(400).json({
        success: false,
        message:"Please provide a valid email address"
      });
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5*60*1000);

    const transporter = nodemailer.createTransport({
      service:"gmail",
      auth:{
        user:process.env.EMAIL_USER,
        pass:process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Dyad Practice Solutions" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to: email,
      subject: "Dyad Practice SolutionsVerification Code",
      text: `Dyad Practice Solutions verification code is: ${otp}\n\nThis code expires in 5 minutes. Do not share it with anyone.\n\nRegards,\nThe Dyad Team\nDyad Practice Solutions`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dyad Practice Solutions Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 20px 40px;">
              <img src="https://landing-dev.dyadmd.com/assets/images/logo_main.png" alt="Dyad Practice Solutions" width="180" style="width:180px;display:block;margin-bottom:12px;" />
               </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:2px solid  #003f7f;margin:0;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 40px 8px 40px;font-size:14px;color:#333333;line-height:1.7;">
            
              <p style="margin:0 0 20px 0;">Use the verification code below to complete your process.</p>
              <div style="background:#f4f7fb;border-radius:6px;padding:20px;text-align:center;margin:0 0 20px 0;">
                <p style="margin:0 0 6px 0;font-size:12px;color:#888888;letter-spacing:1px;text-transform:uppercase;">Your verification code</p>
                <p style="margin:0;font-size:32px;font-weight:700;color:#1b2b3b;letter-spacing:6px;">${otp}</p>
              </div>
              <p style="margin:0 0 28px 0;font-size:13px;color:#888888;">Do not share this code with anyone. Dyad will never ask for your OTP.</p>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:0 40px 28px 40px;font-size:14px;color:#333333;line-height:1.7;">
              <p style="margin:0 0 4px 0;">Regards,</p>
              <p style="margin:0 0 2px 0;font-weight:700;color:#1a6faf;">The Dyad Team</p>
              <p style="margin:0;color:#888888;font-size:13px;">Dyad Practice Solutions</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e0e0e0;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f8f8;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#888888;">
                Dyad Practice Solutions, LLC &nbsp;&bull;&nbsp;
                <a href="https://landing-dev.dyadmd.com" style="color:#1a6faf;text-decoration:none;">dyadmd.com</a>
                &nbsp;&bull;&nbsp;
                <a href="https://landing-dev.dyadmd.com/privacy" style="color:#1a6faf;text-decoration:none;">Privacy Policy</a>
              </p>
              <p style="margin:0;font-size:11px;color:#aaaaaa;">If you did not request this code, you can safely ignore this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });

    // store temporarily in memory (or DB temp table)
    global.otpStore = global.otpStore || {};
    global.otpStore[email] = {otp,expiry};

    res.json({
      success: true,
      message:"OTP sent to your email address"
    });

  }catch(err){
    console.error("Send OTP error:", err);
    res.status(500).json({
      success: false,
      message:"Failed to send OTP. Please try again later."
    });
  }

});

export default router;