import express from "express";

import { pool } from "../config/db.js";

import { createCalendarEventWithMeet } from "../utils/googleCalendarMeet.js";

import { buildMeetingLinkFromId } from "../utils/meetingLink.js";



const router = express.Router();



const createCallsScheduledAdminTable = async () => {

  await pool.query(`

    CREATE TABLE IF NOT EXISTS calls_scheduled_admin (

      id SERIAL PRIMARY KEY,

      email VARCHAR(255) NOT NULL,

      contact_name VARCHAR(255) NOT NULL,

      event_title VARCHAR(255) NOT NULL,

      email_subject VARCHAR(500) NOT NULL,

      call_type VARCHAR(100) NOT NULL,

      mail_description TEXT,

      scheduled_at TIMESTAMP NOT NULL,

      meeting_id TEXT,

      call_event_id TEXT,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

    );



    ALTER TABLE calls_scheduled_admin

      ADD COLUMN IF NOT EXISTS call_event_id TEXT;



    CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_email

      ON calls_scheduled_admin (email);



    CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_meeting_id

      ON calls_scheduled_admin (meeting_id);



    CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_call_event_id

      ON calls_scheduled_admin (call_event_id);



    CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_scheduled_at

      ON calls_scheduled_admin (scheduled_at);



    CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_call_type

      ON calls_scheduled_admin (call_type);

  `);

};



const tableReady = createCallsScheduledAdminTable().catch((err) => {

  console.error("Calls scheduled admin table setup error:", err);

});



const normalizeEmail = (email) =>

  typeof email === "string" ? email.toLowerCase().trim() : null;



const mapRowToResponse = (row) => ({

  id: row.id,

  email: row.email,

  contactName: row.contact_name,

  eventTitle: row.event_title,

  emailSubject: row.email_subject,

  callType: row.call_type,

  mailDescription: row.mail_description,

  dateTime: row.scheduled_at,

  meetingId: row.meeting_id,

  meetingLink: buildMeetingLinkFromId(row.meeting_id),

  callEventId: row.call_event_id,
  createdAt: row.created_at,

  updatedAt: row.updated_at,

});



router.post("/calls-scheduled-admin", async (req, res) => {

  try {

    await tableReady;



    const {

      email,

      contactName,

      contact_name,

      eventTitle,

      event_title,

      emailSubject,

      email_subject,

      callType,

      call_type,

      mailDescription,

      mail_description,

      dateTime,

      date_time,

      scheduledAt,

      scheduled_at,

      createMeetLink = true,

    } = req.body;



    const resolvedEmail = normalizeEmail(email);

    const resolvedContactName = contactName || contact_name;

    const resolvedEventTitle = eventTitle || event_title;

    const resolvedEmailSubject = emailSubject || email_subject;

    const resolvedCallType = callType || call_type;

    const resolvedMailDescription = mailDescription ?? mail_description ?? null;

    const resolvedDateTime = dateTime || date_time || scheduledAt || scheduled_at;



    if (

      !resolvedEmail ||

      !resolvedContactName ||

      !resolvedEventTitle ||

      !resolvedEmailSubject ||

      !resolvedCallType ||

      !resolvedDateTime

    ) {

      return res.status(400).json({

        success: false,

        message:

          "email, contactName, eventTitle, emailSubject, callType, and dateTime are required",

      });

    }



    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(resolvedEmail)) {

      return res.status(400).json({

        success: false,

        message: "Please provide a valid email address",

      });

    }



    const parsedDateTime = new Date(resolvedDateTime);

    if (Number.isNaN(parsedDateTime.getTime())) {

      return res.status(400).json({

        success: false,

        message: "Please provide a valid dateTime value",

      });

    }



    const calendarEvent = await createCalendarEventWithMeet({

      summary: resolvedEventTitle,

      description: resolvedMailDescription || `Scheduled ${resolvedCallType} call`,

      dateTime: parsedDateTime.toISOString(),

      attendeeEmail: resolvedEmail,

      createMeetLink,

    });



    const result = await pool.query(

      `

        INSERT INTO calls_scheduled_admin (

          email,

          contact_name,

          event_title,

          email_subject,

          call_type,

          mail_description,

          scheduled_at,

          meeting_id,

          call_event_id

        )

        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)

        RETURNING *

      `,

      [

        resolvedEmail,

        resolvedContactName,

        resolvedEventTitle,

        resolvedEmailSubject,

        resolvedCallType,

        resolvedMailDescription,

        parsedDateTime,

        calendarEvent.meetingId,

        calendarEvent.callEventId,

      ]

    );



    res.status(201).json({

      success: true,

      message: "Scheduled call saved successfully",

      data: {

        ...mapRowToResponse(result.rows[0]),

        meetingLink: calendarEvent.meetingLink,

        meetingLinkSource: calendarEvent.meetingLinkSource,

        eventLink: calendarEvent.eventLink,

      },

    });

  } catch (err) {

    console.error("Create calls scheduled admin error:", err);

    res.status(500).json({

      success: false,

      message: err.message || "Failed to save scheduled call",

    });

  }

});



router.get("/calls-scheduled-admin", async (req, res) => {

  try {

    await tableReady;



    const { email, meetingId, meeting_id, callType, call_type, limit, offset } =

      req.query;



    const conditions = [];

    const values = [];



    const resolvedEmail = normalizeEmail(email);

    if (resolvedEmail) {

      values.push(resolvedEmail);

      conditions.push(`LOWER(email) = $${values.length}`);

    }



    const resolvedMeetingId = meetingId || meeting_id;

    if (resolvedMeetingId) {

      values.push(resolvedMeetingId);

      conditions.push(`meeting_id = $${values.length}`);

    }



    const resolvedCallType = callType || call_type;

    if (resolvedCallType) {

      values.push(resolvedCallType);

      conditions.push(`call_type = $${values.length}`);

    }



    const whereClause =

      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";



    const parsedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const parsedOffset = Math.max(Number(offset) || 0, 0);



    values.push(parsedLimit);

    const limitParam = `$${values.length}`;

    values.push(parsedOffset);

    const offsetParam = `$${values.length}`;



    const result = await pool.query(

      `

        SELECT *

        FROM calls_scheduled_admin

        ${whereClause}

        ORDER BY scheduled_at DESC, id DESC

        LIMIT ${limitParam}

        OFFSET ${offsetParam}

      `,

      values

    );



    res.status(200).json({

      success: true,

      total: result.rows.length,

      data: result.rows.map(mapRowToResponse),

    });

  } catch (err) {

    console.error("Get calls scheduled admin error:", err);

    res.status(500).json({

      success: false,

      message: "Failed to fetch scheduled calls",

    });

  }

});



export default router;


