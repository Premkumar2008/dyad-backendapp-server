import express from "express";
import { google } from "googleapis";
import axios from "axios";

const router = express.Router();



const auth = new google.auth.GoogleAuth({
  keyFile: "./routes/service-account.json",
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

router.post("/create-event", async (req, res) => {
  try {
    const { title, dateTime } = req.body;

    const client = await auth.getClient();

    const calendar = google.calendar({
      version: "v3",
      auth: client,
    });

    const startTime = new Date(dateTime);
    const endTime = new Date(startTime.getTime() + 30 * 60000);

    const response = await calendar.events.insert({
      calendarId: "dyadcontactrequest@gmail.com",
      resource: {
        summary: "Contact Request from " + title,
        description: "Requested from contact form",
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "Asia/Kolkata",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "Asia/Kolkata",
        },
      },
    });

    console.log("Event created:", response.data);

    res.send("Event created!");
  } catch (error) {
    console.error("FULL ERROR:", error); 
    res.status(500).send(error.message);
  }
});

router.get("/calendar-events", async (req, res) => {
  try {
    const { date } = req.query;            // "2026-04-16"
    
    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const client = await auth.getClient();

    const calendar = google.calendar({
      version: "v3",
      auth: client,
    });

    const calRes = await calendar.events.list({
      calendarId: 'dyadcontactrequest@gmail.com',
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (calRes.data.items || []).map(e => ({
      start: e.start.dateTime || e.start.date,
      end: e.end.dateTime || e.end.date,
    }));

    res.json({ events });
  } catch (error) {
    console.error("FULL ERROR:", error); 
    res.status(500).json({ error: error.message });
  }
});

// Get available slots API
router.get("/slots", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Start and end time parameters are required"
      });
    }

    const calendlyToken = process.env.CALENDLY_TOKEN;
    const eventTypeUri = process.env.EVENT_TYPE_URI;

    if (!calendlyToken || !eventTypeUri) {
      return res.status(500).json({
        success: false,
        message: "CALENDLY_TOKEN and EVENT_TYPE_URI must be configured in environment variables"
      });
    }

    const response = await axios.get(
      "https://api.calendly.com/event_type_available_times",
      {
        headers: {
          Authorization: `Bearer ${calendlyToken}` 
        },
        params: {
          event_type: eventTypeUri,
          start_time: start,
          end_time: end
        }
      }
    );

    res.json({
      success: true,
      data: response.data.collection
    });

  } catch (err) {
    console.error("Slots API Error:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch slots" 
    });
  }
});

// Create booking API
router.post("/book", async (req, res) => {
  try {
    const { name, email, start_time } = req.body;

    console.log("Debug - Booking request:", { name, email, start_time });

    // Validate required fields
    if (!name || !email || !start_time) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and start_time are required"
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    const calendlyToken = process.env.CALENDLY_TOKEN;
    const eventTypeUri = process.env.EVENT_TYPE_URI;

    console.log("Debug - Environment variables:", {
      calendlyToken: calendlyToken ? "SET" : "NOT_SET",
      eventTypeUri: eventTypeUri || "NOT_SET"
    });

    if (!calendlyToken || !eventTypeUri) {
      return res.status(500).json({
        success: false,
        message: "CALENDLY_TOKEN and EVENT_TYPE_URI must be configured in environment variables"
      });
    }

    const response = await axios.post(
      "https://api.calendly.com/scheduled_events",
      {
  "event_type": eventTypeUri,
  "start_time": start_time,
  "invitee": {
     name,
     email
  }
},
      {
        headers: {
          Authorization: `Bearer ${calendlyToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Calendly booking created:", response.data);

    res.json({
      success: true,
      message: "Booking created successfully",
      data: response.data
    });

  } catch (err) {
    console.error("Booking API Error:", err.response?.data || err.message);
    console.error("Full error details:", {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      config: err.config
    });
    
    res.status(500).json({ 
      success: false,
      error: "Booking failed",
      details: err.response?.data || err.message
    });
  }
});

// Helper endpoint to get event types (for debugging)
router.get("/event-types", async (req, res) => {
  try {
    const calendlyToken = process.env.CALENDLY_TOKEN;
    
    if (!calendlyToken) {
      return res.status(500).json({
        success: false,
        message: "CALENDLY_TOKEN not configured"
      });
    }

    const response = await axios.get(
      "https://api.calendly.com/event_types",
      {
        headers: {
          Authorization: `Bearer ${calendlyToken}`
        }
      }
    );

    res.json({
      success: true,
      data: response.data.collection
    });

  } catch (err) {
    console.error("Event types error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: "Failed to get event types"
    });
  }
});

export default router;
