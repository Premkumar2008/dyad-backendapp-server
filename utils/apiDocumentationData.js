export const apiDocumentationMeta = {
  title: "Dyad Backend API Documentation",
  version: "v1",
  baseUrl: "/api",
  generatedFor: "Dyad backend server",
  notes: [
    "All request and response examples reflect the current Express route handlers in this repository.",
    "Most endpoints return JSON. The verify-email endpoint returns plain text, and the documentation endpoint returns a downloadable PDF.",
    "Fields listed as aliases are accepted interchangeably by the backend, even if only one naming style is recommended for new clients.",
  ],
};

const authHeader = {
  name: "Authorization",
  value: "Bearer <access_token>",
  required: true,
  description: "JWT access token returned by the login endpoint.",
};

export const apiDocumentationSections = [
  {
    title: "Authentication and Users",
    description: "Registration, login, OTP verification, password reset, and user profile endpoints.",
    endpoints: [
      {
        method: "POST",
        path: "/api/register",
        summary: "Create a new user account.",
        auth: "Public",
        request: {
          description: "Registers a normal user. `email`, `password`, `npi`, and `phone` are required.",
          body: {
            email: "premkumar.jaguar@example.com",
            password: "StrongPassword123",
            firstName: "Premkumar",
            lastName: "Vellaisamy",
            npi: "1234567890",
            phone: "9715789136",
            emailVerified: false,
          },
        },
        responses: [
          {
            status: 200,
            description: "User created successfully.",
            body: {
              success: true,
              message: "User registered successfully. Please verify your email.",
            },
          },
          {
            status: 409,
            description: "Email or NPI already exists.",
            body: {
              success: false,
              message: "Email already exists",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/login",
        summary: "Authenticate a user and issue JWT tokens.",
        auth: "Public",
        request: {
          body: {
            email: "premkumar.jaguar@example.com",
            password: "StrongPassword123",
          },
        },
        responses: [
          {
            status: 200,
            description: "Login successful.",
            body: {
              success: true,
              accessToken: "<jwt-access-token>",
              refreshToken: "<jwt-refresh-token>",
              user: {
                id: 12,
                email: "premkumar.jaguar@example.com",
                role: "user",
              },
            },
          },
          {
            status: 403,
            description: "Email is not verified.",
            body: {
              success: false,
              message: "Please verify your email first before logging in",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/refresh",
        summary: "Exchange a refresh token for a fresh access token.",
        auth: "Public",
        request: {
          body: {
            refreshToken: "<jwt-refresh-token>",
          },
        },
        responses: [
          {
            status: 200,
            description: "Refresh successful.",
            body: {
              success: true,
              accessToken: "<new-jwt-access-token>",
            },
          },
          {
            status: 403,
            description: "Refresh token is invalid or expired.",
            body: {
              success: false,
              message: "Invalid refresh token",
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/profile",
        summary: "Fetch the currently authenticated user profile.",
        auth: "Bearer token required",
        request: {
          headers: [authHeader],
        },
        responses: [
          {
            status: 200,
            description: "Profile returned.",
            body: {
              success: true,
              data: {
                id: 12,
                first_name: "Premkumar",
                last_name: "Vellaisamy",
                email: "premkumar.jaguar@example.com",
                npi: "1234567890",
                phone: "9715789136",
                role: "user",
              },
            },
          },
          {
            status: 401,
            description: "Missing or invalid bearer token.",
            body: {
              success: false,
              message: "No token provided",
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/verify-email",
        summary: "Verify a user's email using a token from the email link.",
        auth: "Public",
        request: {
          query: [
            {
              name: "token",
              required: true,
              description: "Email verification token.",
            },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Email verified successfully.",
            body: "Email verified successfully",
          },
          {
            status: 400,
            description: "Token missing or invalid.",
            body: "Invalid or expired verification token",
          },
        ],
      },
      {
        method: "POST",
        path: "/api/send-email-otp",
        summary: "Send a registration OTP to the provided email address.",
        auth: "Public",
        request: {
          body: {
            email: "premkumar.jaguar@example.com",
          },
        },
        responses: [
          {
            status: 200,
            description: "OTP email sent.",
            body: {
              success: true,
              message: "OTP sent to your email address",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/verify-otp",
        summary: "Validate the registration OTP and mark the email as verified.",
        auth: "Public",
        request: {
          body: {
            email: "premkumar.jaguar@example.com",
            otp: "123456",
          },
        },
        responses: [
          {
            status: 200,
            description: "OTP accepted.",
            body: {
              success: true,
              message: "OTP verified successfully",
              email_verified: true,
              user: {
                id: 12,
                email_verified: true,
              },
            },
          },
          {
            status: 400,
            description: "OTP missing, invalid, or expired.",
            body: {
              success: false,
              message: "Invalid OTP",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/send-reset-otp",
        summary: "Send a password-reset OTP to the email address.",
        auth: "Public",
        request: {
          body: {
            email: "premkumar.jaguar@example.com",
          },
        },
        responses: [
          {
            status: 200,
            description: "Reset OTP flow completed.",
            body: {
              success: true,
              message: "Password reset OTP sent to your email address",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/reset-password",
        summary: "Reset a user's password after OTP verification.",
        auth: "Public",
        request: {
          body: {
            email: "premkumar.jaguar@example.com",
            otp: "123456",
            newPassword: "EvenStrongerPassword123",
          },
        },
        responses: [
          {
            status: 200,
            description: "Password changed.",
            body: {
              success: true,
              message: "Password reset successfully. You can now login with your new password.",
            },
          },
          {
            status: 400,
            description: "OTP or password validation failed.",
            body: {
              success: false,
              message: "Invalid OTP",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/check-email",
        summary: "Check whether a user email already exists.",
        auth: "Public",
        request: {
          body: {
            email: "premkumar.jaguar@example.com",
          },
        },
        responses: [
          {
            status: 200,
            description: "Existence check completed.",
            body: {
              success: true,
              exists: true,
              message: "Email exists",
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/users",
        summary: "List all users.",
        auth: "Bearer token required",
        request: {
          headers: [authHeader],
        },
        responses: [
          {
            status: 200,
            description: "User list returned.",
            body: {
              success: true,
              data: [
                {
                  id: 12,
                  first_name: "Premkumar",
                  last_name: "Vellaisamy",
                  email: "premkumar.jaguar@example.com",
                  npi: "1234567890",
                  phone: "9715789136",
                  role: "user",
                  email_verified: true,
                  created_at: "2026-06-29T06:30:00.000Z",
                },
              ],
              count: 1,
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/userslist",
        summary: "Return the public list of users without authentication.",
        auth: "Public",
        responses: [
          {
            status: 200,
            description: "User list returned.",
            body: {
              success: true,
              data: [
                {
                  id: 12,
                  first_name: "Premkumar",
                  last_name: "Vellaisamy",
                  email: "premkumar.jaguar@example.com",
                },
              ],
              count: 1,
            },
          },
        ],
      },
      {
        method: "PUT",
        path: "/api/users/:id",
        summary: "Update selected user fields.",
        auth: "Bearer token required",
        request: {
          headers: [authHeader],
          pathParams: [
            {
              name: "id",
              required: true,
              description: "Numeric user id.",
            },
          ],
          body: {
            first_name: "Prem",
            last_name: "V",
            email: "premkumar.updated@example.com",
            npi: "1234567890",
            phone: "9715789136",
            role: "admin",
            email_verified: true,
          },
        },
        responses: [
          {
            status: 200,
            description: "User updated.",
            body: {
              success: true,
              message: "User updated successfully",
              data: {
                id: 12,
                email: "premkumar.updated@example.com",
                role: "admin",
              },
            },
          },
          {
            status: 404,
            description: "User id not found.",
            body: {
              success: false,
              message: "User not found",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/admin/login",
        summary: "Authenticate an admin account and issue admin JWT tokens.",
        auth: "Public",
        request: {
          body: {
            username: "superadmin",
            password: "AdminPassword123",
          },
        },
        responses: [
          {
            status: 200,
            description: "Admin login successful.",
            body: {
              success: true,
              message: "Admin login successful",
              accessToken: "<admin-access-token>",
              refreshToken: "<admin-refresh-token>",
              admin: {
                id: 1,
                username: "superadmin",
                role: "admin",
              },
            },
          },
        ],
      },
    ],
  },
  {
    title: "Contact, Lead Capture, and Email",
    description: "Lead capture, invitation, and transactional email endpoints.",
    endpoints: [
      {
        method: "POST",
        path: "/api/contact-requests",
        summary: "Create a new contact request.",
        auth: "Public",
        request: {
          body: {
            name: "John Doe",
            phoneNumber: "9715789136",
            email: "john.doe@example.com",
            organization: "Healthcare Facility",
            message: "I would like to learn more about your services.",
            scheduledTime: "2026-07-05T10:00:00.000Z",
          },
        },
        responses: [
          {
            status: 201,
            description: "Contact request saved.",
            body: {
              success: true,
              message: "Contact request submitted successfully",
              data: {
                id: 101,
                name: "John Doe",
                phone_number: "9715789136",
                email: "john.doe@example.com",
                organization: "Healthcare Facility",
                message: "I would like to learn more about your services.",
                scheduled_time: "2026-07-05T10:00:00.000Z",
                status: "pending",
              },
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/contact-requests",
        summary: "List contact requests with optional pagination and filters.",
        auth: "Public",
        request: {
          query: [
            { name: "page", required: false, description: "Defaults to 1." },
            { name: "limit", required: false, description: "Defaults to 10." },
            { name: "status", required: false, description: "Filter by workflow status." },
            { name: "organization", required: false, description: "Filter by organization name." },
            { name: "search", required: false, description: "Text search across key fields." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Paginated contact requests returned.",
            body: {
              success: true,
              data: [
                {
                  id: 101,
                  name: "John Doe",
                  email: "john.doe@example.com",
                  status: "pending",
                },
              ],
              pagination: {
                page: 1,
                limit: 10,
                total: 1,
                pages: 1,
              },
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/contact-requests/:id",
        summary: "Fetch a single contact request by id.",
        auth: "Public",
        request: {
          pathParams: [
            { name: "id", required: true, description: "Contact request id." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Contact request returned.",
            body: {
              success: true,
              data: {
                id: 101,
                name: "John Doe",
                email: "john.doe@example.com",
                status: "pending",
              },
            },
          },
          {
            status: 404,
            description: "Contact request not found.",
            body: {
              success: false,
              message: "Contact request not found",
            },
          },
        ],
      },
      {
        method: "PATCH",
        path: "/api/contact-requests/:id/status",
        summary: "Update the workflow status of a contact request.",
        auth: "Public",
        request: {
          pathParams: [
            { name: "id", required: true, description: "Contact request id." },
          ],
          body: {
            status: "contacted",
          },
        },
        responses: [
          {
            status: 200,
            description: "Status updated.",
            body: {
              success: true,
              message: "Contact request status updated successfully",
            },
          },
        ],
      },
      {
        method: "DELETE",
        path: "/api/contact-requests/:id",
        summary: "Delete a contact request.",
        auth: "Public",
        request: {
          pathParams: [
            { name: "id", required: true, description: "Contact request id." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Contact request deleted.",
            body: {
              success: true,
              message: "Contact request deleted successfully",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/send-onboarding-schedule-confirmation",
        summary: "Send a schedule confirmation email with meeting details.",
        auth: "Public",
        request: {
          body: {
            to: "john.doe@example.com",
            subject: "You have scheduled Meeting with Dyad Practice Solutions",
            contactName: "John Doe",
            dateTime: "2026-07-05T10:00:00.000Z",
            meetingLink: "https://meet.google.com/abc-defg-hij",
            calendarEmail: "dyadcontactrequest@gmail.com",
            joinMeetingLabel: "Join Google Meet",
          },
        },
        responses: [
          {
            status: 200,
            description: "Email sent.",
            body: {
              success: true,
              message: "Onboarding schedule confirmation sent successfully",
              messageId: "<smtp-message-id>",
              to: "john.doe@example.com",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/send-email/sendgrid",
        summary: "Send an email and mark the matching early-access row as emailed.",
        auth: "Public",
        request: {
          body: {
            to: "john.doe@example.com",
            subject: "Welcome to Dyad",
            html: "<p>Your invite is ready.</p>",
            text: "Your invite is ready.",
          },
        },
        responses: [
          {
            status: 200,
            description: "Email sent.",
            body: {
              success: true,
              message: "Email sent successfully",
              messageId: "<smtp-message-id>",
            },
          },
        ],
      },
    ],
  },
  {
    title: "Scheduling and Calendar",
    description: "Google Calendar and Calendly-based scheduling endpoints.",
    endpoints: [
      {
        method: "POST",
        path: "/api/create-event",
        summary: "Create a Google Calendar event and optionally attach a Google Meet link.",
        auth: "Public",
        request: {
          body: {
            title: "Intro Call",
            dateTime: "2026-07-05T10:00:00.000Z",
            onboardingId: "onb_123456",
            description: "Requested from onboarding flow",
            createMeetLink: true,
          },
        },
        responses: [
          {
            status: 201,
            description: "Event created successfully.",
            body: {
              success: true,
              message: "Event created!",
              eventId: "1m7q8exampleeventid",
              callEventId: "1m7q8exampleeventid",
              meetingLink: "https://meet.google.com/abc-defg-hij",
              meetingId: "abc-defg-hij",
              meetingLinkSource: "google_calendar",
              eventLink: "https://calendar.google.com/calendar/event?eid=...",
              start: {
                dateTime: "2026-07-05T10:00:00.000Z",
                timeZone: "Asia/Kolkata",
              },
              end: {
                dateTime: "2026-07-05T10:30:00.000Z",
                timeZone: "Asia/Kolkata",
              },
            },
          },
        ],
      },
      {
        method: "PATCH | PUT | POST",
        path: "/api/update-event",
        summary: "Update or reschedule an existing calendar event. The same handler accepts three verbs.",
        auth: "Public",
        request: {
          description: "Recommended fields are shown below; several aliases are also accepted by the backend.",
          body: {
            eventId: "1m7q8exampleeventid",
            title: "Rescheduled Intro Call",
            dateTime: "2026-07-05T11:00:00.000Z",
            description: "Updated description",
            createMeetLink: true,
            onboardingId: "onb_123456",
          },
        },
        responses: [
          {
            status: 200,
            description: "Event updated successfully.",
            body: {
              success: true,
              message: "Event updated successfully",
              eventId: "1m7q8exampleeventid",
              meetingLink: "https://meet.google.com/abc-defg-hij",
              meetingId: "abc-defg-hij",
            },
          },
          {
            status: 404,
            description: "Calendar event not found.",
            body: {
              success: false,
              message: "Event not found",
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/calendar-events",
        summary: "Return event start and end times for a single date.",
        auth: "Public",
        request: {
          query: [
            { name: "date", required: true, description: "Date in YYYY-MM-DD format." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Events returned.",
            body: {
              events: [
                {
                  start: "2026-07-05T10:00:00.000Z",
                  end: "2026-07-05T10:30:00.000Z",
                },
              ],
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/calendar/available-slots",
        summary: "Compute available Google Calendar slots for a day.",
        auth: "Public",
        request: {
          query: [
            { name: "date", required: true, description: "Date in YYYY-MM-DD format." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Available slots returned.",
            body: {
              success: true,
              date: "2026-07-05",
              calendarId: "dyadcontactrequest@gmail.com",
              timeZone: "Asia/Kolkata",
              slotDurationMinutes: 30,
              availableSlots: [
                {
                  start: "2026-07-05T09:00:00+05:30",
                  end: "2026-07-05T09:30:00+05:30",
                },
              ],
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/slots",
        summary: "Fetch Calendly availability between a start and end time.",
        auth: "Public",
        request: {
          query: [
            { name: "start", required: true, description: "ISO start date-time." },
            { name: "end", required: true, description: "ISO end date-time." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Calendly slots returned.",
            body: {
              success: true,
              data: [
                {
                  start_time: "2026-07-05T10:00:00.000Z",
                  scheduling_url: "https://calendly.com/...",
                },
              ],
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/book",
        summary: "Create a Calendly booking.",
        auth: "Public",
        request: {
          body: {
            name: "John Doe",
            email: "john.doe@example.com",
            start_time: "2026-07-05T10:00:00.000Z",
          },
        },
        responses: [
          {
            status: 200,
            description: "Booking created.",
            body: {
              success: true,
              message: "Booking created successfully",
              data: {
                uri: "https://api.calendly.com/scheduled_events/...",
              },
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/event-types",
        summary: "Return Calendly event types configured for the token owner.",
        auth: "Public",
        responses: [
          {
            status: 200,
            description: "Event types returned.",
            body: {
              success: true,
              data: [
                {
                  name: "Discovery Call",
                  uri: "https://api.calendly.com/event_types/...",
                },
              ],
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/calendly/webhook",
        summary: "Receive Calendly webhook events. Primarily handles invitee-created events.",
        auth: "Public",
        request: {
          body: {
            event: "invitee.created",
            payload: {
              email: "john.doe@example.com",
              name: "John Doe",
            },
          },
        },
        responses: [
          {
            status: 200,
            description: "Webhook accepted.",
            body: {},
          },
        ],
      },
      {
        method: "POST",
        path: "/api/calls-scheduled-admin",
        summary: "Persist an admin-managed scheduled call record.",
        auth: "Public",
        request: {
          description: "Aliases like `contact_name`, `event_title`, and `meeting_id` are also accepted.",
          body: {
            email: "john.doe@example.com",
            contactName: "John Doe",
            eventTitle: "Admin Follow-up Call",
            emailSubject: "Your Dyad call is scheduled",
            callType: "onboarding",
            mailDescription: "Please join on time.",
            dateTime: "2026-07-05T10:00:00.000Z",
            meetingId: "abc-defg-hij",
          },
        },
        responses: [
          {
            status: 201,
            description: "Scheduled call saved.",
            body: {
              success: true,
              message: "Scheduled call saved successfully",
              data: {
                id: 14,
                email: "john.doe@example.com",
                contactName: "John Doe",
                eventTitle: "Admin Follow-up Call",
                emailSubject: "Your Dyad call is scheduled",
                callType: "onboarding",
                mailDescription: "Please join on time.",
                dateTime: "2026-07-05T10:00:00.000Z",
                meetingId: "abc-defg-hij",
                meetingLink: "https://meet.google.com/abc-defg-hij",
              },
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/calls-scheduled-admin",
        summary: "List admin scheduled calls with filters.",
        auth: "Public",
        request: {
          query: [
            { name: "email", required: false, description: "Filter by email." },
            { name: "meetingId", required: false, description: "Filter by meeting id." },
            { name: "callType", required: false, description: "Filter by call type." },
            { name: "limit", required: false, description: "Defaults to 100, max 500." },
            { name: "offset", required: false, description: "Defaults to 0." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Scheduled calls returned.",
            body: {
              success: true,
              total: 1,
              data: [
                {
                  id: 14,
                  email: "john.doe@example.com",
                  meetingId: "abc-defg-hij",
                  meetingLink: "https://meet.google.com/abc-defg-hij",
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Early Access and Onboarding",
    description: "Lead qualification, onboarding data capture, and readback endpoints.",
    endpoints: [
      {
        method: "POST",
        path: "/api/api-early-access",
        summary: "Submit a new early-access request.",
        auth: "Public",
        request: {
          body: {
            practiceName: "ABC Clinic",
            contactName: "Dr. Jane Smith",
            phoneNumber: "9715789136",
            email: "jane.smith@example.com",
            title: "Owner",
            practiceType: "Behavioral Health",
            npi: "1234567890",
            providers: 5,
            locations: 2,
            claimVolume: "500-1000",
          },
        },
        responses: [
          {
            status: 201,
            description: "Early-access request created.",
            body: {
              success: true,
              message: "Early access request submitted successfully",
              data: {
                id: 21,
                email: "jane.smith@example.com",
                status: "pending",
              },
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/api-early-access/check-email",
        summary: "Check whether an early-access email already exists.",
        auth: "Public",
        request: {
          body: {
            email: "jane.smith@example.com",
          },
        },
        responses: [
          {
            status: 200,
            description: "Existence check returned.",
            body: {
              success: true,
              exists: true,
              message: "Email already registered for early access",
              status: "pending",
              submittedAt: "2026-06-29T08:00:00.000Z",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/api-early-access/check-npi",
        summary: "Check whether an NPI already exists in early access.",
        auth: "Public",
        request: {
          body: {
            npi: "1234567890",
          },
        },
        responses: [
          {
            status: 200,
            description: "Existence check returned.",
            body: {
              success: true,
              exists: false,
              message: "NPI is available",
            },
          },
        ],
      },
      {
        method: "PATCH",
        path: "/api/api-early-access/:id",
        summary: "Update early-access status and invitation flags.",
        auth: "Public",
        request: {
          pathParams: [
            { name: "id", required: true, description: "Early-access request id." },
          ],
          body: {
            betaInvite: true,
            invitationSent: true,
            status: "approved",
          },
        },
        responses: [
          {
            status: 200,
            description: "Early-access record updated.",
            body: {
              success: true,
              message: "Early access request updated successfully",
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/api-early-access",
        summary: "List all early-access requests.",
        auth: "Public",
        responses: [
          {
            status: 200,
            description: "Early-access requests returned.",
            body: {
              success: true,
              total: 1,
              data: [
                {
                  id: 21,
                  email: "jane.smith@example.com",
                  status: "pending",
                },
              ],
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/api-early-access/send-invite",
        summary: "Send invite emails to multiple early-access requests by id.",
        auth: "Public",
        request: {
          body: {
            ids: [21, 22],
            subject: "Your Dyad invite",
            html: "<p>Welcome to Dyad.</p>",
            text: "Welcome to Dyad.",
          },
        },
        responses: [
          {
            status: 200,
            description: "Invite emails sent.",
            body: {
              success: true,
              message: "Invitation emails sent successfully",
              sent: 2,
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/api-early-access/send-invite-email",
        summary: "Send one custom invite email.",
        auth: "Public",
        request: {
          body: {
            email: "jane.smith@example.com",
            subject: "You are invited",
            html: "<p>Join the beta.</p>",
            text: "Join the beta.",
          },
        },
        responses: [
          {
            status: 200,
            description: "Custom invite email sent.",
            body: {
              success: true,
              message: "Invite email sent successfully",
              messageId: "<smtp-message-id>",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/onboarding/check-email",
        summary: "Check whether an onboarding record already exists for an email address.",
        auth: "Public",
        request: {
          body: {
            email: "jane.smith@example.com",
          },
        },
        responses: [
          {
            status: 200,
            description: "Existence check returned.",
            body: {
              success: true,
              exists: true,
              onboardingId: "onb_123456",
              status: "Onboarding",
              message: "Onboarding record already exists",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/onboarding-client/check-npi",
        summary: "Check whether an onboarding record already exists for an NPI.",
        auth: "Public",
        request: {
          body: {
            npi: "1234567890",
          },
        },
        responses: [
          {
            status: 200,
            description: "Existence check returned.",
            body: {
              success: true,
              exists: false,
              message: "NPI is available",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/onboarding/step/:step",
        summary: "Save step payloads for onboarding steps 1 through 6.",
        auth: "Public",
        request: {
          pathParams: [
            { name: "step", required: true, description: "Step number from 1 to 6." },
          ],
          description: "The backend stores arbitrary JSON payloads. For steps 2-6, provide `onboardingId` unless the record can be inferred from identifiers.",
          body: {
            onboardingId: "onb_123456",
            contactEmail: "jane.smith@example.com",
            contactName: "Dr. Jane Smith",
            npi: "1234567890",
            meetingId: "abc-defg-hij",
            stepPayload: {
              plan: "monthly",
              amount: 99,
            },
          },
        },
        responses: [
          {
            status: 200,
            description: "Step saved successfully.",
            body: {
              success: true,
              message: "Onboarding step saved successfully",
              onboardingId: "onb_123456",
              status: "Onboarding",
              meetingId: "abc-defg-hij",
              meetingLink: "https://meet.google.com/abc-defg-hij",
              completedSteps: [1, 2, 3],
              data: {
                onboardingId: "onb_123456",
              },
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/onboarding",
        summary: "List all onboarding records.",
        auth: "Public",
        responses: [
          {
            status: 200,
            description: "Onboarding records returned.",
            body: {
              success: true,
              total: 1,
              data: [
                {
                  onboardingId: "onb_123456",
                  status: "Onboarding",
                  completedSteps: [1, 2, 3],
                },
              ],
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/onboarding/:onboardingId",
        summary: "Fetch a single onboarding record with aggregated step data.",
        auth: "Public",
        request: {
          pathParams: [
            { name: "onboardingId", required: true, description: "Application onboarding id." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Onboarding record returned.",
            body: {
              success: true,
              onboardingId: "onb_123456",
              meetingId: "abc-defg-hij",
              meetingLink: "https://meet.google.com/abc-defg-hij",
              completedSteps: [1, 2, 3],
              data: {
                step_1_payload: {},
                step_2_payload: {},
              },
            },
          },
          {
            status: 404,
            description: "Onboarding record not found.",
            body: {
              success: false,
              message: "Onboarding record not found",
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/onboarding/:onboardingId/step/:step",
        summary: "Fetch a specific onboarding step payload.",
        auth: "Public",
        request: {
          pathParams: [
            { name: "onboardingId", required: true, description: "Application onboarding id." },
            { name: "step", required: true, description: "Step number from 1 to 6." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Step payload returned.",
            body: {
              success: true,
              onboardingId: "onb_123456",
              step: 3,
              meetingId: "abc-defg-hij",
              meetingLink: "https://meet.google.com/abc-defg-hij",
              data: {
                amount: 99,
                plan: "monthly",
              },
            },
          },
        ],
      },
    ],
  },
  {
    title: "Utility Data and Validation",
    description: "reCAPTCHA verification and external registry lookups.",
    endpoints: [
      {
        method: "POST",
        path: "/api/verify-recaptcha",
        summary: "Verify a reCAPTCHA token against the configured secret.",
        auth: "Public",
        request: {
          body: {
            token: "<recaptcha-token>",
          },
        },
        responses: [
          {
            status: 200,
            description: "Verification completed.",
            body: {
              success: true,
              message: "reCAPTCHA verified successfully",
              errorCodes: [],
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/npi/registry",
        summary: "Look up a provider from the CMS NPI registry.",
        auth: "Public",
        request: {
          body: {
            npi: "1234567890",
          },
        },
        responses: [
          {
            status: 200,
            description: "Provider data returned.",
            body: {
              success: true,
              message: "NPI record found",
              data: {
                npi: "1234567890",
                enumeration_type: "NPI-1",
                basic: {
                  first_name: "Jane",
                  last_name: "Smith",
                },
                addresses: [],
                taxonomies: [],
                identifiers: [],
                other_names: [],
              },
            },
          },
          {
            status: 404,
            description: "No record found for the NPI.",
            body: {
              success: false,
              message: "No NPI record found",
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/taxonomies",
        summary: "Return the provider taxonomy code list.",
        auth: "Public",
        responses: [
          {
            status: 200,
            description: "Taxonomy list returned.",
            body: {
              success: true,
              total: 2,
              data: ["261QH0100X", "208D00000X"],
            },
          },
        ],
      },
    ],
  },
  {
    title: "Zoho Payments and Subscriptions",
    description: "Zoho customer creation, payment session creation, payment verification, and recurring billing.",
    endpoints: [
      {
        method: "POST",
        path: "/api/customer",
        summary: "Create or reuse a Zoho customer for a local owner record.",
        auth: "Public",
        request: {
          body: {
            onboardingId: "onb_123456",
            name: "Dr. Jane Smith",
            email: "jane.smith@example.com",
            phone: "9715789136",
          },
        },
        responses: [
          {
            status: 200,
            description: "Customer mapping returned.",
            body: {
              customerId: "903000000012345",
              isNew: true,
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/create-session",
        summary: "Create a Zoho ACH payment session.",
        auth: "Public",
        request: {
          body: {
            customerId: "903000000012345",
            amount: 99,
            currency: "USD",
            plan: "monthly",
          },
        },
        responses: [
          {
            status: 200,
            description: "Payment session returned for Zoho widget initialization.",
            body: {
              session_id: "903000000054321",
              payments_session_id: "903000000054321",
              customer_id: "903000000012345",
              account_id: "926398629",
              api_key: "<zoho-api-key>",
              plan: "monthly",
              amount: 99,
              currency: "USD",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/verify-payment",
        summary: "Verify the status of a Zoho payment after widget completion.",
        auth: "Public",
        request: {
          body: {
            payment_id: "903000000078901",
          },
        },
        responses: [
          {
            status: 200,
            description: "Payment status returned.",
            body: {
              success: true,
              payment_id: "903000000078901",
              status: "succeeded",
              customer_id: "903000000012345",
              payment_method_id: "903000000011111",
              amount: 99,
              currency: "USD",
              data: {
                payment_id: "903000000078901",
              },
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/create-payment-method-session",
        summary: "Create a Zoho session for saving an ACH payment method.",
        auth: "Public",
        request: {
          body: {
            customerId: "903000000012345",
            description: "Save ACH for recurring subscription",
          },
        },
        responses: [
          {
            status: 200,
            description: "Payment method session returned.",
            body: {
              payment_method_session_id: "903000000066666",
              customer_id: "903000000012345",
              account_id: "926398629",
              api_key: "<zoho-api-key>",
              widget: {
                payment_method: "ach_debit",
                transaction_type: "add",
                customer_id: "903000000012345",
                payment_method_session_id: "903000000066666",
              },
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/save-subscription",
        summary: "Persist the recurring subscription after a successful payment and payment-method capture.",
        auth: "Public",
        request: {
          body: {
            onboardingId: "onb_123456",
            customerId: "903000000012345",
            payment_id: "903000000078901",
            payment_method_id: "903000000011111",
            plan: "monthly",
            amount: 99,
            currency: "USD",
          },
        },
        responses: [
          {
            status: 201,
            description: "Subscription created in the local database.",
            body: {
              success: true,
              isNew: true,
              data: {
                owner_id: "onb_123456",
                zoho_customer_id: "903000000012345",
                zoho_payment_id: "903000000078901",
                zoho_payment_method_id: "903000000011111",
                plan: "monthly",
                amount: "99.00",
                currency: "USD",
                status: "active",
              },
            },
          },
        ],
      },
      {
        method: "GET",
        path: "/api/subscription/:ownerId",
        summary: "Fetch the saved Zoho subscription for a user or onboarding owner id.",
        auth: "Public",
        request: {
          pathParams: [
            { name: "ownerId", required: true, description: "Local userId or onboardingId." },
          ],
        },
        responses: [
          {
            status: 200,
            description: "Subscription returned.",
            body: {
              success: true,
              data: {
                owner_id: "onb_123456",
                status: "active",
                next_charge: "2026-08-05T10:00:00.000Z",
              },
            },
          },
          {
            status: 404,
            description: "No subscription exists for the owner.",
            body: {
              error: "No subscription found",
            },
          },
        ],
      },
      {
        method: "POST",
        path: "/api/run-recurring-billing",
        summary: "Trigger charging for all due subscriptions.",
        auth: "Public, optionally guarded by cron secret",
        request: {
          headers: [
            {
              name: "x-cron-secret",
              value: "<cron-secret>",
              required: false,
              description: "Required only when `CRON_SECRET` or `ZOHO_CRON_SECRET` is configured.",
            },
          ],
          body: {
            cronSecret: "<cron-secret>",
          },
        },
        responses: [
          {
            status: 200,
            description: "Recurring billing batch completed.",
            body: {
              success: true,
              processed: 1,
              results: [
                {
                  subscriptionId: 1,
                  success: true,
                  paymentId: "903000000099999",
                  nextCharge: "2026-09-05T10:00:00.000Z",
                },
              ],
            },
          },
          {
            status: 401,
            description: "Secret is missing or invalid when protection is enabled.",
            body: {
              error: "Unauthorized",
            },
          },
        ],
      },
    ],
  },
];
