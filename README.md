# Dyad Backend Server

A Node.js Express backend server with authentication, user management, and email verification features.

## Features

- **User Authentication**: Registration, login, and token refresh
- **Email Verification**: OTP-based email verification system
- **Password Reset**: Secure password reset via email
- **User Profile**: Get user profile information
- **API Documentation**: Downloadable Excel file with API endpoints
- **Role-based Access**: User role management

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `POST /api/refresh` - Refresh access token
- `POST /api/send-email-otp` - Send registration OTP
- `POST /api/verify-otp` - Verify email OTP
- `POST /api/send-reset-otp` - Send password reset OTP
- `POST /api/reset-password` - Reset password with OTP

### User Management
- `GET /api/profile` - Get user profile (requires authentication)
- `GET /api/verify-email` - Verify email via token

### Documentation
- `GET /api/api-documentation` - Download API documentation as Excel

### Testing
- `GET /api/test` - Basic server test
- `GET /api/test-env` - Environment configuration test

## Installation

### Prerequisites
- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- PostgreSQL database

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Premkumar2008/dyad-backend-server.git
   cd dyad-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/dyad_db
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASS=your-gmail-app-password
   ```

4. **Database Setup**
   Create PostgreSQL database and run migrations if needed.

## Development

### Running in Development Mode
```bash
npm run dev
```
Server will run on `http://localhost:5000` with auto-restart on file changes.

### Testing
```bash
npm test
```

## Production Deployment

### Build for Production
```bash
npm run build
```

### Running in Production
```bash
npm start
```

### Environment Variables for Production
- `NODE_ENV=production`
- `PORT=5000` (or your preferred port)
- `DATABASE_URL` - Production PostgreSQL connection string
- `JWT_SECRET` - Strong secret key for JWT
- `JWT_REFRESH_SECRET` - Strong secret key for refresh tokens
- `EMAIL_USER` - Gmail address for sending emails
- `EMAIL_PASS` - Gmail app password

## Gmail Setup for Email Features

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate new app password
   - Use this password in `EMAIL_PASS`

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    npi VARCHAR(20),
    phone VARCHAR(20),
    email_verified BOOLEAN DEFAULT FALSE,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verification_token VARCHAR(255)
);
```

## Security Features

- **Password Hashing**: Using bcryptjs for secure password storage
- **JWT Authentication**: Secure token-based authentication
- **Email Verification**: OTP-based email verification
- **Input Validation**: Request payload validation
- **Rate Limiting**: Consider implementing for production
- **CORS**: Cross-origin resource sharing configured

## Error Handling

All API responses follow consistent format:
```json
{
  "success": true/false,
  "message": "Descriptive message",
  "data": {} // optional
}
```

## Deployment Options

### 1. **Vercel**
- Easy deployment for Node.js applications
- Automatic HTTPS and scaling

### 2. **Heroku**
- Platform as a Service for Node.js
- Add-on support for PostgreSQL

### 3. **DigitalOcean/AWS**
- Virtual private server deployment
- Full control over environment

### 4. **Docker**
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Monitoring and Logging

- Application logs are sent to console
- Consider implementing structured logging for production
- Monitor database connection health
- Track email delivery success rates

## License

ISC License
