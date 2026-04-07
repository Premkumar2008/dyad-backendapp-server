import express from "express";
import { pool } from "../config/db.js";
import { verifyRecaptcha } from "../middleware/recaptcha.js";
import { google } from "googleapis";

const router = express.Router();

// Setup Google Calendar OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Set up credentials if refresh token is available
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
}

const calendar = google.calendar({
  version: "v3",
  auth: oauth2Client,
});

// Function to create calendar event
async function createCalendarEvent(contactData) {
  try {
    const { name, email, phoneNumber, organization, message, scheduledTime } = contactData;
    
    if (!scheduledTime) {
      console.log("No scheduled time provided, skipping calendar event creation");
      return null;
    }

    // Parse the scheduled time
    const scheduledDate = new Date(scheduledTime);
    
    // Add 30 minutes for end time
    const endTime = new Date(scheduledDate.getTime() + 30 * 60000); // 30 minutes in milliseconds

    const event = {
      summary: name, // Use name as title
      description: `Contact: ${name}\nEmail: ${email}\nPhone: ${phoneNumber}\nOrganization: ${organization}\n\n${message || ''}`,
      start: {
        dateTime: scheduledDate.toISOString(),
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "Asia/Kolkata",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 } // 30 minutes before
        ]
      }
    };

    const response = await calendar.events.insert({
      calendarId: "primary", // Your primary calendar (premkumar200894ss@gmail.com)
      resource: event,
    });

    console.log("Calendar event created:", response.data.htmlLink);
    return response.data;
  } catch (error) {
    console.error("Calendar event creation error:", error);
    return null;
  }
}

// Create a new contact request
router.post("/contact-requests", async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      email,
      organization,
      message,
      scheduledTime,
      recaptchaToken
    } = req.body;

    // Verify reCAPTCHA token first
    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA verification is required"
      });
    }

    // Temporary bypass for testing - remove this in production
    if (recaptchaToken === "test_token") {
      console.log("Using test token - bypassing reCAPTCHA verification");
    } else {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, req.ip);
      
      if (!recaptchaResult.success) {
        return res.status(400).json({
          success: false,
          message: "reCAPTCHA verification failed",
          error: recaptchaResult.message,
          errorCodes: recaptchaResult.errorCodes
        });
      }
    }

    // Validate required fields
    if (!name || !phoneNumber || !email || !organization) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number, email, and organization are required"
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

    // Insert contact request into database
    const result = await pool.query(
      `INSERT INTO contact_requests 
       (name, phone_number, email, organization, message, scheduled_time, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, phone_number, email, organization, message, scheduled_time, status, created_at`,
      [
        name,
        phoneNumber,
        email,
        organization,
        message || null,
        scheduledTime || null,
        'pending',
        new Date()
      ]
    );

    // Create calendar event if scheduled time is provided
    const contactData = {
      name,
      email,
      phoneNumber,
      organization,
      message,
      scheduledTime
    };

    const calendarEvent = await createCalendarEvent(contactData);

    res.status(201).json({
      success: true,
      message: "Contact request submitted successfully",
      data: result.rows[0],
      calendarEvent: calendarEvent ? {
        id: calendarEvent.id,
        title: calendarEvent.summary,
        start: calendarEvent.start,
        end: calendarEvent.end,
        link: calendarEvent.htmlLink
      } : null
    });

  } catch (err) {
    console.error("Contact request error:", err);
    
    if (err.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: "A similar request already exists"
      });
    }
    
    if (err.code === '23502') { // Not null violation
      return res.status(400).json({
        success: false,
        message: "Missing required field"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to submit contact request"
    });
  }
});

// Get all contact requests (with pagination and filtering)
router.get("/contact-requests", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      organization,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramIndex = 1;

    // Add filters
    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (organization) {
      whereClause += ` AND organization ILIKE $${paramIndex}`;
      queryParams.push(`%${organization}%`);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR message ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM contact_requests ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const query = `
      SELECT id, name, phone_number, email, organization, message, scheduled_time, status, created_at
      FROM contact_requests 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error("Get contact requests error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve contact requests"
    });
  }
});

// Get a single contact request by ID
router.get("/contact-requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, name, phone_number, email, organization, message, scheduled_time, status, created_at
       FROM contact_requests 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Contact request not found"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Get contact request error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve contact request"
    });
  }
});

// Update contact request status
router.patch("/contact-requests/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const validStatuses = ['pending', 'contacted', 'scheduled', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: pending, contacted, scheduled, completed, cancelled"
      });
    }

    const result = await pool.query(
      `UPDATE contact_requests 
       SET status = $1, updated_at = $2
       WHERE id = $3
       RETURNING id, name, phone_number, email, organization, status`,
      [status, new Date(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Contact request not found"
      });
    }

    res.json({
      success: true,
      message: "Contact request status updated successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Update contact request status error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update contact request status"
    });
  }
});

// Delete a contact request
router.delete("/contact-requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM contact_requests WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Contact request not found"
      });
    }

    res.json({
      success: true,
      message: "Contact request deleted successfully"
    });

  } catch (err) {
    console.error("Delete contact request error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete contact request"
    });
  }
});

// Google OAuth endpoints for calendar setup
router.get("/auth/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
    prompt: "consent"
  });
  res.json({ authUrl: url });
});

router.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('Refresh token received:', tokens.refresh_token);
    console.log('Add this to your .env file: GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    
    oauth2Client.setCredentials(tokens);
    global.oauthClient = oauth2Client;
    
    res.send(`
      <h2>Authentication Successful!</h2>
      <p>Your Google Calendar is now connected.</p>
      <p>Refresh Token: <code>${tokens.refresh_token}</code></p>
      <p>Add this token to your .env file as GOOGLE_REFRESH_TOKEN</p>
      <p>You can close this window.</p>
    `);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Test calendar event creation
router.post("/test-calendar-event", async (req, res) => {
  try {
    const { name, email, phoneNumber, organization, message, scheduledTime } = req.body;
    
    const contactData = { name, email, phoneNumber, organization, message, scheduledTime };
    const calendarEvent = await createCalendarEvent(contactData);
    
    if (calendarEvent) {
      res.json({
        success: true,
        message: "Test calendar event created successfully",
        event: {
          id: calendarEvent.id,
          title: calendarEvent.summary,
          start: calendarEvent.start,
          end: calendarEvent.end,
          link: calendarEvent.htmlLink
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to create calendar event"
      });
    }
  } catch (error) {
    console.error("Test calendar event error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create test calendar event",
      error: error.message
    });
  }
});

export default router;
