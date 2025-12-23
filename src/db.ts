import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create a MySQL connection pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',  // Ensure this is empty for no password
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the connection (for debugging)
pool.getConnection()
  .then(() => {
    console.log('Database connected successfully!');
  })
  .catch(err => {
    console.error('Error connecting to the database:', err.message);
  });
