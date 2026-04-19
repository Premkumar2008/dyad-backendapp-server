import express from "express";

const router = express.Router();

// Simple Calendly webhook endpoint matching your example
router.post("/webhook", (req, res) => {
  const body = req.body;

  console.log("Webhook received:", body);

  if (body.event === "invitee.created") {
    const booking = {
      eventName: body.payload.event.name,
      startTime: body.payload.event.start_time,
      endTime: body.payload.event.end_time,
      userName: body.payload.invitee.name,
      userEmail: body.payload.invitee.email,
    };

    console.log("Booking Data:", booking);

    // You can add database logic here later if needed
  }

  // Always return 200 to acknowledge receipt
  res.sendStatus(200);
});

export default router;
