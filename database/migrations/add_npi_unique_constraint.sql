-- Migration: Add unique constraint to NPI column
-- This ensures NPI numbers are unique across all users

ALTER TABLE users 
ADD CONSTRAINT users_npi_unique 
UNIQUE (npi);
