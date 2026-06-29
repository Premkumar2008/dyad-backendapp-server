import { randomUUID } from "crypto";
import { getCalendarClient, getCalendarAuthMode, hasValidGoogleRefreshToken } from "./googleCalendarAuth.js";
import {
  buildGoogleMeetConferenceData,
  buildMeetingDescription,
  extractMeetCodeFromLink,
  getMeetingDetailsFromCalendarEvent,
  isConferenceCreationError,
} from "./meetingLink.js";

const DEFAULT_CALENDAR_EMAIL = "dyadcontactrequest@gmail.com";
const CALENDAR_TIME_ZONE = "Asia/Kolkata";
const DEFAULT_DURATION_MINUTES = 30;

export const getCalendarId = () =>
  process.env.EMAIL_USER_CALENDER || process.env.CALENDAR_ID || DEFAULT_CALENDAR_EMAIL;

export const getCalendarTimeZone = () =>
  process.env.CALENDAR_TIME_ZONE || CALENDAR_TIME_ZONE;

const canInviteCalendarAttendees = () =>
  getCalendarAuthMode() === "oauth_user" ||
  process.env.GOOGLE_CALENDAR_DOMAIN_WIDE_DELEGATION === "true" ||
  process.env.GOOGLE_CALENDAR_SEND_INVITES === "true";

const isAttendeeInvitationError = (error) => {
  const message = `${error?.message || ""} ${error?.response?.data?.error?.message || ""}`.toLowerCase();
  return (
    error?.code === 403 &&
    (message.includes("domain-wide delegation") ||
      message.includes("cannot invite attendees"))
  );
};

const buildEventResource = ({
  summary,
  description,
  startTime,
  endTime,
  timeZone,
  attendeeEmail,
}) => {
  const resource = {
    summary: summary || "Scheduled Call",
    description: description || "",
    start: {
      dateTime: startTime.toISOString(),
      timeZone,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone,
    },
  };

  if (attendeeEmail && canInviteCalendarAttendees()) {
    resource.attendees = [{ email: attendeeEmail }];
  } else if (attendeeEmail) {
    const attendeeLine = `Participant email: ${attendeeEmail}`;
    resource.description = resource.description
      ? `${resource.description}\n\n${attendeeLine}`
      : attendeeLine;
  }

  return resource;
};

const resolveSendUpdates = (sendUpdates, attendeeEmail) => {
  if (attendeeEmail && canInviteCalendarAttendees()) {
    return sendUpdates;
  }
  return "none";
};

export const attachGoogleMeetToEvent = async (calendar, calendarId, eventId) => {
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
    const googleMessage = error?.response?.data?.error?.message || error.message;
    if (!isConferenceCreationError(error)) {
      console.warn("Google Meet attach failed:", googleMessage);
    } else {
      console.warn("Google Meet conference type rejected:", googleMessage);
    }
  }

  return null;
};

const insertEventWithMeet = async (calendar, calendarId, eventResource, sendUpdates) => {
  try {
    const response = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      sendUpdates,
      resource: {
        ...eventResource,
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
    if (isAttendeeInvitationError(error)) {
      throw error;
    }
    if (!isConferenceCreationError(error)) {
      console.warn("Google Meet insert with conference failed:", error.message);
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

export const buildEventMeetingResponse = (
  event,
  { meetingLink = null, meetingId = null, meetingLinkSource = null } = {}
) => {
  const eventMeeting = getMeetingDetailsFromCalendarEvent(event);
  const resolvedMeetingLink = meetingLink || eventMeeting.meetingLink || null;
  const resolvedMeetingId =
    meetingId ||
    eventMeeting.meetingId ||
    (resolvedMeetingLink ? extractMeetCodeFromLink(resolvedMeetingLink) : null);

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

/**
 * Creates a Google Calendar event with a unique Google Meet link per call.
 * Each invocation creates a separate calendar event and conference, so parallel
 * scheduled calls each receive their own meeting room.
 */
export const createCalendarEventWithMeet = async ({
  summary,
  description = "",
  dateTime,
  durationMinutes = DEFAULT_DURATION_MINUTES,
  attendeeEmail,
  sendUpdates = "all",
  createMeetLink = true,
}) => {
  const calendar = await getCalendarClient();
  const calendarId = getCalendarId();
  const timeZone = getCalendarTimeZone();
  const startTime = new Date(dateTime);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  if (Number.isNaN(startTime.getTime())) {
    throw new Error("Invalid dateTime provided");
  }

  if (createMeetLink !== false && !hasValidGoogleRefreshToken()) {
    throw new Error(
      "GOOGLE_REFRESH_TOKEN is missing or still set to the placeholder. " +
        "Open http://localhost:5000/api/google-calendar/auth-url, sign in as the calendar owner, " +
        "copy refresh_token into .env, then restart the server."
    );
  }

  const baseDescription = description || "";
  let eventResource = buildEventResource({
    summary: summary || "Scheduled Call",
    description: baseDescription,
    startTime,
    endTime,
    timeZone,
    attendeeEmail,
  });
  const resolvedSendUpdates = resolveSendUpdates(sendUpdates, attendeeEmail);

  let eventData;
  let meetingLink = null;
  let meetingId = null;
  let meetingLinkSource = null;

  if (createMeetLink !== false) {
    let insertedWithMeet = null;

    try {
      insertedWithMeet = await insertEventWithMeet(
        calendar,
        calendarId,
        eventResource,
        resolvedSendUpdates
      );
    } catch (error) {
      if (isAttendeeInvitationError(error) && attendeeEmail) {
        console.warn(
          "Calendar attendee invite not permitted; retrying without attendees:",
          attendeeEmail
        );
        eventResource = buildEventResource({
          summary: summary || "Scheduled Call",
          description: baseDescription,
          startTime,
          endTime,
          timeZone,
          attendeeEmail: null,
        });
        eventResource.description = baseDescription
          ? `${baseDescription}\n\nParticipant email: ${attendeeEmail}`
          : `Participant email: ${attendeeEmail}`;
        insertedWithMeet = await insertEventWithMeet(
          calendar,
          calendarId,
          eventResource,
          "none"
        );
      } else {
        throw error;
      }
    }

    if (insertedWithMeet) {
      eventData = insertedWithMeet.eventData;
      meetingLink = insertedWithMeet.meetingLink;
      meetingId = insertedWithMeet.meetingId;
      meetingLinkSource = insertedWithMeet.meetingLinkSource;
    } else {
      let response;

      try {
        response = await calendar.events.insert({
          calendarId,
          conferenceDataVersion: 0,
          sendUpdates: resolvedSendUpdates,
          resource: eventResource,
        });
      } catch (error) {
        if (isAttendeeInvitationError(error) && attendeeEmail) {
          eventResource = buildEventResource({
            summary: summary || "Scheduled Call",
            description: baseDescription,
            startTime,
            endTime,
            timeZone,
            attendeeEmail: null,
          });
          eventResource.description = baseDescription
            ? `${baseDescription}\n\nParticipant email: ${attendeeEmail}`
            : `Participant email: ${attendeeEmail}`;
          response = await calendar.events.insert({
            calendarId,
            conferenceDataVersion: 0,
            sendUpdates: "none",
            resource: eventResource,
          });
        } else {
          throw error;
        }
      }

      eventData = response.data;

      const attachedMeet = await attachGoogleMeetToEvent(
        calendar,
        calendarId,
        eventData.id
      );

      if (!attachedMeet) {
        await calendar.events.delete({ calendarId, eventId: eventData.id });

        if (getCalendarAuthMode() === "service_account") {
          throw new Error(
            "Google Meet cannot be created with a service account on personal Gmail. " +
              "Authorize the calendar owner via GET /api/google-calendar/auth-url, " +
              "set GOOGLE_REFRESH_TOKEN in .env, and restart the server."
          );
        }

        throw new Error(
          "Failed to create a unique Google Meet link. Verify Google Calendar API access and that the configured calendar account can create Meet conferences."
        );
      }

      eventData = attachedMeet.eventData;
      meetingLink = attachedMeet.meetingLink;
      meetingId = attachedMeet.meetingId;
      meetingLinkSource = attachedMeet.meetingLinkSource;
    }

    eventData = await applyMeetingToEvent(calendar, calendarId, eventData.id, {
      meetingLink,
      baseDescription,
    });
  } else {
    const response = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 0,
      sendUpdates: resolvedSendUpdates,
      resource: eventResource,
    });
    eventData = response.data;
  }

  return buildEventMeetingResponse(eventData, {
    meetingLink,
    meetingId,
    meetingLinkSource,
  });
};
