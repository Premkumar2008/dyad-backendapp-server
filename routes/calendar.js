import express from "express";
import { google } from "googleapis";

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  client_id,
  CLIENT_SECRET,
  "http://localhost:5000/auth/callback"
);

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/calendar"],
});

console.log("OAuth URL:", url);

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
      calendarId: "premkumar200894ss@gmail.com",
      resource: {
        summary: title,
        description: "Booked via app",
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

export default router;
