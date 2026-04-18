-- Remove duplicate NPI records, keeping the earliest one
DELETE FROM users 
WHERE id NOT IN (
    SELECT MIN(id)
    FROM users 
    WHERE npi IS NOT NULL AND npi != ''
    GROUP BY npi
)
AND npi IS NOT NULL AND npi != '';

-- After removing duplicates, add the unique constraint
ALTER TABLE users 
ADD CONSTRAINT users_npi_unique 
UNIQUE (npi);
