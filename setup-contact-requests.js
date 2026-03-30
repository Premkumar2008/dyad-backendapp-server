import { pool } from "./config/db.js";
import fs from 'fs';
import path from 'path';

async function setupContactRequestsTable() {
  try {
    console.log('Setting up contact_requests table...');
    
    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('Contact requests table created successfully!');
    
    // Check if table exists
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'contact_requests'
    `);
    
    if (result.rows.length > 0) {
      console.log('Contact requests table verified!');
    } else {
      console.log('Contact requests table not found');
    }
    
  } catch (error) {
    console.error('Contact requests setup error:', error);
  } finally {
    await pool.end();
  }
}

setupContactRequestsTable();
