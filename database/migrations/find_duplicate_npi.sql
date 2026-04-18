-- Find duplicate NPI numbers in the users table
SELECT npi, COUNT(*) as count
FROM users 
WHERE npi IS NOT NULL AND npi != ''
GROUP BY npi 
HAVING COUNT(*) > 1;
