-- Show all records with duplicate NPI numbers
SELECT id, email, first_name, last_name, npi, created_at
FROM users 
WHERE npi IN (
    SELECT npi 
    FROM users 
    WHERE npi IS NOT NULL AND npi != ''
    GROUP BY npi 
    HAVING COUNT(*) > 1
)
ORDER BY npi, created_at;
