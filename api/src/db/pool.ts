import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/urban',
  // Postgres allows 100 connections by default; the API is the only client.
  // 10 (the pg default) serializes query throughput under concurrent load.
  max: parseInt(process.env.DB_POOL_MAX || '25', 10),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});
