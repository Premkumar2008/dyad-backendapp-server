import express from "express";
import { google } from "googleapis";

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

export default router;
