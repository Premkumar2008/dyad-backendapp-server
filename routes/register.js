import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

const router = express.Router();

router.post("/register", async (req,res)=>{

 try{

 const {email,password,firstName,lastName,npi,phone} = req.body;

 if(!email || !password || !firstName || !lastName || !npi || !phone){
  return res.status(400).json({
    success: false,
    message:"All fields are required: email, password, firstName, lastName, npi, phone"
  });
 }

 const hash = await bcrypt.hash(password,10);

 await pool.query(
  `INSERT INTO users
  (email,password_hash,first_name,last_name,npi,phone,email_verified,role)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [email,hash,firstName,lastName,npi,phone,false,'user']
 );

 res.json({
  success: true,
  message:"User registered successfully. Please verify your email."
 });

 }catch(err){
  console.error("Registration error:", err);

  if(err.code === '23505'){ // Unique constraint violation
   return res.status(409).json({
     success: false,
     message: "Email already exists"
   });
  }
  
  if(err.code === '23502'){ // Not null violation
   return res.status(400).json({
     success: false,
     message: "Missing required field"
   });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error during registration"
  });

 }

});

export default router;