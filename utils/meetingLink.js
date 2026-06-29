import { randomUUID } from "crypto";

export const extractMeetCodeFromLink = (link) => {
  if (!link || typeof link !== "string") {
    return null;
  }

  const match = link.match(/meet\.google\.com\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
};

export const buildGoogleMeetConferenceData = (requestId = randomUUID()) => ({
  createRequest: {
    requestId,
    conferenceSolutionKey: { type: "hangoutsMeet" },
  },
});

export const getMeetingDetailsFromCalendarEvent = (event) => {
  const entryPoints = event?.conferenceData?.entryPoints || [];
  const videoEntry = entryPoints.find((entry) => entry.entryPointType === "video");
  const meetingLink =
    videoEntry?.uri ||
    event?.hangoutLink ||
    (typeof event?.location === "string" && event.location.includes("meet.google.com")
      ? event.location
      : null);

  const meetingId =
    event?.conferenceData?.conferenceId ||
    extractMeetCodeFromLink(meetingLink) ||
    null;

  return { meetingLink, meetingId };
};

export const normalizeMeetingUrl = (link) => {
  if (!link || typeof link !== "string") {
    return null;
  }

  const trimmed = link.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const isConferenceCreationError = (error) => {
  const message = `${error?.message || ""} ${error?.cause?.message || ""}`.toLowerCase();
  return (
    error?.code === 400 &&
    (message.includes("invalid conference type") ||
      message.includes("conference type") ||
      message.includes("conference"))
  );
};

export const generateUniqueMeetingCode = () => {
  const chars = "abcdefghijkmnopqrstuvwxyz";
  const segment = (length) =>
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return `${segment(3)}-${segment(4)}-${segment(3)}`;
};

export const createFallbackMeeting = () => {
  const meetingId = generateUniqueMeetingCode();

  return {
    meetingId,
    meetingLink: `https://meet.google.com/${meetingId}`,
    source: "generated",
  };
};

export const buildMeetingLinkFromId = (meetingId) => {
  if (!meetingId || typeof meetingId !== "string") {
    return null;
  }

  if (meetingId.startsWith("http")) {
    return normalizeMeetingUrl(meetingId);
  }

  const meetCode = extractMeetCodeFromLink(meetingId) || meetingId;
  if (/^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/i.test(meetCode)) {
    return `https://meet.google.com/${meetCode}`;
  }

  return null;
};

export const buildMeetingDescription = (meetingLink, baseDescription = "") => {
  if (!meetingLink) {
    return baseDescription;
  }

  const meetLine = `Join Google Meet: ${meetingLink}`;
  return baseDescription ? `${meetLine}\n\n${baseDescription}` : meetLine;
};
