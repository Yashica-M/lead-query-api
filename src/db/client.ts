/**
 * Database Singleton Connection Pool
 *
 * Configures shared Knex database client instance.
 * Manages connection pooling (min 2, max 10) and conditionally enforces SSL parameters
 * for cloud-hosted PostgreSQL providers (Supabase).
 */

import knex from 'knex';
import 'dotenv/config';

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase')
      ? { rejectUnauthorized: false }
      : false,
  },
  pool: {
    min: 0, // 0 for serverless — don't keep idle connections alive between invocations
    max: 10,
  },
});

export default db;
