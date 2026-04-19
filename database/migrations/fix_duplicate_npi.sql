-- Step 1: First, remove the unique constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_npi_unique;

-- Step 2: Find and show duplicate NPIs
SELECT npi, COUNT(*) as count, STRING_AGG(email, ', ') as emails
FROM users 
WHERE npi IS NOT NULL AND npi != '' AND npi != 'null'
GROUP BY npi 
HAVING COUNT(*) > 1;

-- Step 3: Update duplicate NPIs to NULL (keeping only the first occurrence)
UPDATE users 
SET npi = NULL
WHERE id NOT IN (
    SELECT DISTINCT ON (npi) id 
    FROM users 
    WHERE npi IS NOT NULL AND npi != '' AND npi != 'null'
    ORDER BY npi, created_at ASC
)
AND npi IS NOT NULL AND npi != '' AND npi != 'null';

-- Step 4: Add the unique constraint back
ALTER TABLE users 
ADD CONSTRAINT users_npi_unique 
UNIQUE (npi);

-- Step 5: Verify the fix
SELECT COUNT(*) as total_users, 
       COUNT(CASE WHEN npi IS NOT NULL AND npi != '' AND npi != 'null' THEN 1 END) as users_with_npi,
       COUNT(DISTINCT npi) as unique_npi_count
FROM users;
