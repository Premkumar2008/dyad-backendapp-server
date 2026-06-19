import express from "express";
import { randomUUID } from "crypto";
import axios from "axios";
import { pool } from "../config/db.js";
import { getCalendarClient } from "../utils/googleCalendarAuth.js";
import {
  buildGoogleMeetConferenceData,
  buildMeetingDescription,
  createFallbackMeeting,
  getMeetingDetailsFromCalendarEvent,
  isConferenceCreationError,
} from "../utils/meetingLink.js";

const router = express.Router();

const DEFAULT_CALENDAR_EMAIL = "dyadcontactrequest@gmail.com";
const CALENDAR_TIME_ZONE = "Asia/Kolkata";
const DEFAULT_SLOT_DURATION_MINUTES = 30;
const DEFAULT_DAY_START_TIME = "09:00";
const DEFAULT_DAY_END_TIME = "18:00";

const getCalendarId = () =>
  process.env.EMAIL_USER_CALENDER || process.env.CALENDAR_ID || DEFAULT_CALENDAR_EMAIL;

const isValidDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
};

const getNextDate = (date) => {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
};

const getKolkataDateTime = (date, time) => new Date(`${date}T${time}:00+05:30`);

const hasOverlap = (slotStart, slotEnd, busyStart, busyEnd) =>
  slotStart < busyEnd && slotEnd > busyStart;



const syncOnboardingMeeting = async ({ onboardingId, meetingId, callEventId }) => {
  if (!onboardingId || (!meetingId && !callEventId)) {
    return;
  }

  await pool.query(
    `
      UPDATE onboarding_steps
      SET
        meeting_id = COALESCE($1, meeting_id),
        call_event_id = COALESCE($2, call_event_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE onboarding_id = $3
    `,
    [meetingId, callEventId, onboardingId]
  );
};

const buildEventMeetingResponse = (
  event,
  { meetingLink = null, meetingId = null, meetingLinkSource = null } = {}
) => {
  const eventMeeting = getMeetingDetailsFromCalendarEvent(event);
  const resolvedMeetingLink = meetingLink || eventMeeting.meetingLink || null;
  const resolvedMeetingId =
    meetingId ||
    eventMeeting.meetingId ||
    (resolvedMeetingLink ? randomUUID() : null);

  return {
    eventId: event.id,
    callEventId: event.id,
    meetingLink: resolvedMeetingLink,
    meetingId: resolvedMeetingId,
    meetingLinkSource:
      meetingLinkSource ||
      (eventMeeting.meetingLink ? "google_calendar" : null),
    eventLink: event.htmlLink,
    start: event.start,
    end: event.end,
  };
};

const tryAttachGoogleMeetToEvent = async (calendar, calendarId, eventId) => {
  try {
    const response = await calendar.events.patch({
      calendarId,
      eventId,
      conferenceDataVersion: 1,
      requestBody: {
        conferenceData: buildGoogleMeetConferenceData(randomUUID()),
      },
    });

    const meetingDetails = getMeetingDetailsFromCalendarEvent(response.data);
    if (meetingDetails.meetingLink) {
      return {
        eventData: response.data,
        ...meetingDetails,
        meetingLinkSource: "google_calendar",
      };
    }
  } catch (error) {
    if (!isConferenceCreationError(error)) {
      console.warn("Google Meet attach failed:", error.message);
    }
  }

  return null;
};

const applyMeetingToEvent = async (
  calendar,
  calendarId,
  eventId,
  { meetingLink, baseDescription }
) => {
  const response = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      location: meetingLink,
      description: buildMeetingDescription(meetingLink, baseDescription),
    },
  });

  return response.data;
};

router.post("/create-event", async (req, res) => {
  try {
    const {
      title,
      dateTime,
      onboardingId,
      description: descriptionFromBody,
      createMeetLink = true,
    } = req.body;

    if (!dateTime) {
      return res.status(400).json({
        success: false,
        message: "dateTime is required",
      });
    }

    console.log(`[create-event] ${req.method} called -> will INSERT a new event`);

    const calendar = await getCalendarClient();
    const calendarId = getCalendarId();
    const startTime = new Date(dateTime);
    const endTime = new Date(startTime.getTime() + 30 * 60000);

    if (Number.isNaN(startTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid dateTime provided",
      });
    }

    const baseDescription =
      descriptionFromBody || "Requested from contact form";

    const eventResource = {
      summary: title ? `Contact Request from ${title}` : "Contact Request",
      description: baseDescription,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: CALENDAR_TIME_ZONE,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: CALENDAR_TIME_ZONE,
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 0,
      resource: eventResource,
    });

    let eventData = response.data;
    let meetingLink = null;
    let meetingId = null;
    let meetingLinkSource = null;

    if (createMeetLink !== false) {
      const attachedMeet = await tryAttachGoogleMeetToEvent(
        calendar,
        calendarId,
        eventData.id
      );

      if (attachedMeet) {
        eventData = attachedMeet.eventData;
        meetingLink = attachedMeet.meetingLink;
        meetingId = attachedMeet.meetingId;
        meetingLinkSource = attachedMeet.meetingLinkSource;
      } else {
        const fallbackMeeting = createFallbackMeeting();
        meetingLink = fallbackMeeting.meetingLink;
        meetingId = fallbackMeeting.meetingId;
        meetingLinkSource = fallbackMeeting.source;
      }

      eventData = await applyMeetingToEvent(calendar, calendarId, eventData.id, {
        meetingLink,
        baseDescription,
      });
    }

    const eventResponse = buildEventMeetingResponse(eventData, {
      meetingLink,
      meetingId,
      meetingLinkSource,
    });
    await syncOnboardingMeeting({
      onboardingId,
      meetingId: eventResponse.meetingId,
      callEventId: eventResponse.callEventId,
    });

    console.log("Event created:", eventData.id, "meetingId:", eventResponse.meetingId);

    res.status(201).json({
      success: true,
      message: "Event created!",
      ...eventResponse,
    });
  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create event",
      error: error.message,
    });
  }
});

router.patch("/update-event", async (req, res) => {
  await handleUpdateEvent(req, res);
});

router.put("/update-event", async (req, res) => {
  await handleUpdateEvent(req, res);
});

router.post("/update-event", async (req, res) => {
  await handleUpdateEvent(req, res);
});

async function handleUpdateEvent(req, res) {
  try {
    const {
      eventId,
      id,
      googleEventId,
      calendarEventId,
      calendarId: calendarIdFromBody,
      meetingLink: meetingLinkFromBody,
      meetLink,
      hangoutLink,
      googleMeetLink,
      joinUrl,
      description,
      joinMeetingLabel,
      includeJoinMeetingInDescription = true,
      createMeetLink = true,
      onboardingId,
      sendUpdates = "all",
      title,
      summary,
      eventTitle,
      dateTime,
      startDateTime,
      endDateTime,
      start,
      end,
      timeZone,
    } = req.body;

    const resolvedEventId = eventId || id || googleEventId || calendarEventId;
    const calendarId = calendarIdFromBody || getCalendarId();
    const resolvedTitle = title || summary || eventTitle;
    let resolvedMeetingLink =
      meetingLinkFromBody || meetLink || hangoutLink || googleMeetLink || joinUrl;
    const resolvedTimeZone = timeZone || CALENDAR_TIME_ZONE;

    console.log(
      `[update-event] ${req.method} called -> PATCH eventId: ${resolvedEventId} on calendar: ${calendarId}`
    );

    if (!resolvedEventId) {
      return res.status(400).json({
        success: false,
        message: "eventId is required (accepts eventId, id, googleEventId, or calendarEventId)",
      });
    }

    const calendar = await getCalendarClient();

    // Confirm the event exists before patching so we never silently create a duplicate.
    let existingEvent;
    try {
      const existing = await calendar.events.get({ calendarId, eventId: resolvedEventId });
      existingEvent = existing.data;
    } catch (getErr) {
      if (getErr.code === 404) {
        return res.status(404).json({
          success: false,
          message: "Event not found. It may have been deleted or the eventId is invalid.",
          eventId: resolvedEventId,
        });
      }
      throw getErr;
    }

    if (!resolvedMeetingLink) {
      const existingMeeting = getMeetingDetailsFromCalendarEvent(existingEvent);
      resolvedMeetingLink = existingMeeting.meetingLink;
    }

    const requestBody = {};

    if (typeof resolvedTitle === "string") {
      requestBody.summary = resolvedTitle;
    }

    if (typeof description === "string") {
      let finalDescription = description;

      if (
        includeJoinMeetingInDescription &&
        resolvedMeetingLink &&
        !description.includes(resolvedMeetingLink)
      ) {
        const label = joinMeetingLabel || "Join Google Meet";
        finalDescription = `${label}: ${resolvedMeetingLink}\n\n${description}`;
      }

      requestBody.description = finalDescription;
    }

    if (resolvedMeetingLink) {
      requestBody.location = resolvedMeetingLink;
    }

    const shouldTryCreateMeet = !resolvedMeetingLink && createMeetLink !== false;

    // Reschedule support: prefer explicit start/end objects, then ISO strings, then a single dateTime.
    const startInput = start?.dateTime || startDateTime || dateTime;
    if (startInput) {
      const startTime = new Date(startInput);
      const endInput = end?.dateTime || endDateTime;
      const endTime = endInput
        ? new Date(endInput)
        : new Date(startTime.getTime() + 30 * 60000);

      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid start/end date-time provided",
        });
      }

      requestBody.start = {
        dateTime: startTime.toISOString(),
        timeZone: start?.timeZone || resolvedTimeZone,
      };
      requestBody.end = {
        dateTime: endTime.toISOString(),
        timeZone: end?.timeZone || resolvedTimeZone,
      };
    }

    // Reactivate an event that was previously cancelled/deleted so the update is visible again.
    if (existingEvent.status === "cancelled") {
      requestBody.status = "confirmed";
    }

    if (Object.keys(requestBody).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No updatable fields provided",
      });
    }

    const validSendUpdates = ["all", "externalOnly", "none"];
    const resolvedSendUpdates = validSendUpdates.includes(sendUpdates) ? sendUpdates : "all";

    const response = await calendar.events.patch({
      calendarId,
      eventId: resolvedEventId,
      sendUpdates: resolvedSendUpdates,
      requestBody,
    });

    let eventData = response.data;
    let meetingLink = resolvedMeetingLink;
    let meetingId = null;
    let meetingLinkSource = null;

    const existingMeeting = getMeetingDetailsFromCalendarEvent(eventData);
    if (existingMeeting.meetingLink) {
      meetingLink = existingMeeting.meetingLink;
      meetingId = existingMeeting.meetingId;
      meetingLinkSource = "google_calendar";
    } else if (shouldTryCreateMeet) {
      const attachedMeet = await tryAttachGoogleMeetToEvent(
        calendar,
        calendarId,
        resolvedEventId
      );

      if (attachedMeet) {
        eventData = attachedMeet.eventData;
        meetingLink = attachedMeet.meetingLink;
        meetingId = attachedMeet.meetingId;
        meetingLinkSource = attachedMeet.meetingLinkSource;
      } else {
        const fallbackMeeting = createFallbackMeeting();
        meetingLink = fallbackMeeting.meetingLink;
        meetingId = fallbackMeeting.meetingId;
        meetingLinkSource = fallbackMeeting.source;
      }

      eventData = await applyMeetingToEvent(calendar, calendarId, resolvedEventId, {
        meetingLink,
        baseDescription:
          typeof description === "string" ? description : existingEvent.description || "",
      });
    }

    const eventResponse = buildEventMeetingResponse(eventData, {
      meetingLink,
      meetingId,
      meetingLinkSource,
    });

    await syncOnboardingMeeting({
      onboardingId,
      meetingId: eventResponse.meetingId,
      callEventId: eventResponse.callEventId,
    });

    console.log("Event updated:", eventData.id, "meetingId:", eventResponse.meetingId);

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      ...eventResponse,
    });
  } catch (error) {
    console.error("Update event error:", error.response?.data || error.message);

    if (error.code === 404) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update event",
      error: error.message,
    });
  }
}

router.get("/calendar-events", async (req, res) => {
  try {
    const { date } = req.query;            // "2026-04-16"
    
    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const calendar = await getCalendarClient();

    const calRes = await calendar.events.list({
      calendarId: getCalendarId(),
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

// Get available slots for a selected calendar date
router.get("/calendar/available-slots", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Valid date query parameter is required in YYYY-MM-DD format"
      });
    }

    const calendarId = getCalendarId();
    const slotDurationMinutes = Number(process.env.CALENDAR_SLOT_DURATION_MINUTES) || DEFAULT_SLOT_DURATION_MINUTES;
    const dayStartTime = process.env.CALENDAR_DAY_START_TIME || DEFAULT_DAY_START_TIME;
    const dayEndTime = process.env.CALENDAR_DAY_END_TIME || DEFAULT_DAY_END_TIME;
    const nextDate = getNextDate(date);

    const dayStart = getKolkataDateTime(date, "00:00");
    const dayEnd = getKolkataDateTime(nextDate, "00:00");
    const availabilityStart = getKolkataDateTime(date, dayStartTime);
    const availabilityEnd = getKolkataDateTime(date, dayEndTime);

    if (availabilityStart >= availabilityEnd) {
      return res.status(500).json({
        success: false,
        message: "Calendar availability start time must be before end time"
      });
    }

    const calendar = await getCalendarClient();

    const calRes = await calendar.events.list({
      calendarId,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const busySlots = (calRes.data.items || [])
      .filter((event) => event.status !== "cancelled")
      .map((event) => ({
        start: new Date(event.start.dateTime || event.start.date),
        end: new Date(event.end.dateTime || event.end.date),
      }))
      .filter(({ start, end }) => !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()));

    const availableSlots = [];
    const slotDurationMs = slotDurationMinutes * 60 * 1000;

    for (
      let slotStart = new Date(availabilityStart);
      slotStart.getTime() + slotDurationMs <= availabilityEnd.getTime();
      slotStart = new Date(slotStart.getTime() + slotDurationMs)
    ) {
      const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
      const isAvailable = !busySlots.some(({ start, end }) =>
        hasOverlap(slotStart, slotEnd, start, end)
      );

      if (isAvailable) {
        availableSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
    }

    res.json({
      success: true,
      date,
      calendarId,
      timeZone: CALENDAR_TIME_ZONE,
      slotDurationMinutes,
      availableSlots,
    });
  } catch (error) {
    console.error("Available slots error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available slots",
      error: error.message,
      hint:
        error.message?.includes("service account") ||
        error.message?.includes("GOOGLE_SERVICE_ACCOUNT_JSON")
          ? "Configure Google Calendar credentials in production."
          : undefined,
    });
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
