import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/refresh", (req,res)=>{

 const { refreshToken } = req.body;

 if(!refreshToken){
  return res.status(401).json({
    success: false,
    message:"Refresh token is required"
  });
 }

 try{

  const decoded = jwt.verify(
   refreshToken,
   process.env.JWT_REFRESH_SECRET
  );

  const accessToken = jwt.sign(
   { id: decoded.id },
   process.env.JWT_SECRET,
   { expiresIn: "15m" }
  );

  res.json({ 
    success: true,
    accessToken 
  });

 }catch(err){
  console.error("Token refresh error:", err);
  
  if(err.name === 'TokenExpiredError'){
    return res.status(403).json({
      success: false,
      message:"Refresh token has expired"
    });
  }
  
  if(err.name === 'JsonWebTokenError'){
    return res.status(403).json({
      success: false,
      message:"Invalid refresh token"
    });
  }

  res.status(403).json({
    success: false,
    message:"Token refresh failed"
  });

 }

});

export default router;