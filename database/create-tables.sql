-- =====================================================
-- DYAD PRACTICE SOLUTIONS - EXECUTABLE SQL
-- =====================================================
-- Execute these commands in order to create complete database
-- 

-- =====================================================
-- 1. CREATE USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    userrole VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    email_otp VARCHAR(10),
    otp_expiry TIMESTAMP,
    npi VARCHAR(20)
);

-- =====================================================
-- 2. CREATE CONTACT REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS contact_requests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    message TEXT,
    scheduled_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'contacted', 'scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. CREATE INDEXES FOR USERS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_npi ON users(npi);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- =====================================================
-- 4. CREATE INDEXES FOR CONTACT REQUESTS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_contact_requests_email ON contact_requests(email);
CREATE INDEX IF NOT EXISTS idx_contact_requests_organization ON contact_requests(organization);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at ON contact_requests(created_at);

-- =====================================================
-- 5. CREATE FUNCTIONS FOR AUTO-UPDATE TIMESTAMPS
-- =====================================================
-- Function for users table
CREATE OR REPLACE FUNCTION update_users_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function for contact_requests table
CREATE OR REPLACE FUNCTION update_contact_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 6. CREATE TRIGGERS FOR AUTO-UPDATE
-- =====================================================
-- Trigger for users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_users_updated_at_column();

-- Trigger for contact_requests table
CREATE TRIGGER update_contact_requests_updated_at 
    BEFORE UPDATE ON contact_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_contact_requests_updated_at();

-- =====================================================
-- 7. ADD CONSTRAINTS FOR USERS TABLE
-- =====================================================
-- Role constraints
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS chk_role 
CHECK (role IN ('user', 'admin', 'moderator', 'doctor', 'nurse', 'staff'));

ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS chk_userrole 
CHECK (userrole IN ('user', 'admin', 'moderator', 'doctor', 'nurse', 'staff'));

-- Email verification constraint
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS chk_email_verified 
CHECK (email_verified IN (TRUE, FALSE));

-- NPI uniqueness constraint
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS users_npi_unique 
UNIQUE (npi);

-- =====================================================
-- 8. ADD TABLE COMMENTS (Optional)
-- =====================================================
-- Users table comments
COMMENT ON TABLE users IS 'User accounts table for authentication and profile management';
COMMENT ON COLUMN users.id IS 'Unique identifier for each user';
COMMENT ON COLUMN users.first_name IS 'User first name (optional)';
COMMENT ON COLUMN users.last_name IS 'User last name (optional)';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.phone IS 'User phone number';
COMMENT ON COLUMN users.password_hash IS 'Hashed password using bcrypt';
COMMENT ON COLUMN users.role IS 'User role for permissions (legacy)';
COMMENT ON COLUMN users.userrole IS 'User role for permissions (current)';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN users.email_verified IS 'Email verification status';
COMMENT ON COLUMN users.verification_token IS 'Token for email verification';
COMMENT ON COLUMN users.email_otp IS 'One-time password for email verification';
COMMENT ON COLUMN users.otp_expiry IS 'OTP expiration timestamp';
COMMENT ON COLUMN users.npi IS 'National Provider Identifier (for medical professionals)';

-- Contact requests table comments
COMMENT ON TABLE contact_requests IS 'Contact form submissions and consultation requests';
COMMENT ON COLUMN contact_requests.id IS 'Unique identifier for each contact request';
COMMENT ON COLUMN contact_requests.name IS 'Contact person name';
COMMENT ON COLUMN contact_requests.phone_number IS 'Contact person phone number';
COMMENT ON COLUMN contact_requests.email IS 'Contact person email address';
COMMENT ON COLUMN contact_requests.organization IS 'Organization or company name';
COMMENT ON COLUMN contact_requests.message IS 'Message or consultation reason';
COMMENT ON COLUMN contact_requests.scheduled_time IS 'Scheduled consultation time';
COMMENT ON COLUMN contact_requests.status IS 'Request status: pending, contacted, scheduled, completed, cancelled';
COMMENT ON COLUMN contact_requests.created_at IS 'Request submission timestamp';
COMMENT ON COLUMN contact_requests.updated_at IS 'Last update timestamp';

-- =====================================================
-- 9. VERIFICATION QUERIES
-- =====================================================
-- Check if tables were created successfully
SELECT 'users table created successfully' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.tables 
WHERE table_name = 'users' AND table_schema = 'public');

SELECT 'contact_requests table created successfully' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.tables 
WHERE table_name = 'contact_requests' AND table_schema = 'public');

-- Check if indexes were created
SELECT COUNT(*) as indexes_created 
FROM pg_indexes 
WHERE schemaname = 'public' AND tablename IN ('users', 'contact_requests');

-- Check if constraints were added
SELECT COUNT(*) as constraints_added 
FROM information_schema.table_constraints 
WHERE table_schema = 'public' AND table_name IN ('users', 'contact_requests');

-- =====================================================
-- EXECUTION COMPLETE
-- =====================================================
SELECT 'DATABASE SETUP COMPLETE - All tables, indexes, constraints, and triggers created successfully' as final_status;
