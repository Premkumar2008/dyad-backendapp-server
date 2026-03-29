import nodemailer from "nodemailer";

export const sendVerificationEmail = async (email, token) => {

 const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
   user: process.env.EMAIL_USER,
   pass: process.env.EMAIL_PASS
  }
 });

 const verificationLink =
  `http://localhost:5000/api/verify-email?token=${token}`;

 await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: email,
  subject: "Verify your email",
  html: `
   <h2>Email Verification</h2>
   <p>Please click the link below</p>
   <a href="${verificationLink}">Verify Email</a>
  `
 });

};