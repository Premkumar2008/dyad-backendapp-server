-- Users Table Schema
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    email_otp VARCHAR(10),
    otp_expiry TIMESTAMP,
    npi VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    userrole VARCHAR(50) DEFAULT 'user'
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_npi ON users(npi);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_users_updated_at_column();

-- Constraints for data integrity
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS chk_role 
CHECK (role IN ('user', 'admin', 'moderator', 'doctor', 'nurse', 'staff'));

ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS chk_userrole 
CHECK (userrole IN ('user', 'admin', 'moderator', 'doctor', 'nurse', 'staff'));

ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS chk_email_verified 
CHECK (email_verified IN (TRUE, FALSE));

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts table for authentication and profile management';
COMMENT ON COLUMN users.id IS 'Unique identifier for each user';
COMMENT ON COLUMN users.first_name IS 'User first name';
COMMENT ON COLUMN users.last_name IS 'User last name';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.phone IS 'User phone number';
COMMENT ON COLUMN users.password_hash IS 'Hashed password using bcrypt';
COMMENT ON COLUMN users.role IS 'User role for permissions';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.email_verified IS 'Email verification status';
COMMENT ON COLUMN users.verification_token IS 'Token for email verification';
COMMENT ON COLUMN users.email_otp IS 'One-time password for email verification';
COMMENT ON COLUMN users.otp_expiry IS 'OTP expiration timestamp';
COMMENT ON COLUMN users.npi IS 'National Provider Identifier (for medical professionals)';
COMMENT ON COLUMN users.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN users.userrole IS 'Additional user role field';

-- Optional: Insert default admin user (remove in production)
-- INSERT INTO users (first_name, last_name, email, password_hash, role, userrole, email_verified)
-- VALUES ('Admin', 'User', 'admin@example.com', '$2b$10$...', 'admin', 'admin', TRUE)
-- ON CONFLICT (email) DO NOTHING;
