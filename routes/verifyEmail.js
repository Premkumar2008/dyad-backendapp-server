import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/verify-email", async (req,res)=>{
  try{
    const { token } = req.query;

    if(!token){
      return res.status(400).send("Verification token is required");
    }

    const result = await pool.query(
      `UPDATE users
       SET email_verified=true
       WHERE verification_token=$1
       RETURNING id`,
      [token]
    );

    if(result.rowCount === 0){
      return res.status(400).send("Invalid or expired verification token");
    }

    res.send("Email verified successfully");

  }catch(err){
    console.error("Email verification error:", err);
    res.status(500).send("Email verification failed due to server error");
  }

});

export default router;