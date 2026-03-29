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
      from:process.env.EMAIL_USER,
      to:email,
      subject:"Your Verification OTP",
      html:`<h2>Your OTP is ${otp}</h2>`
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