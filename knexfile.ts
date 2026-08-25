/**
 * Knex CLI config — used for running migrations and seeds.
 * Separate from src/db/client.ts but uses the same connection settings.
 */

import type { Knex } from 'knex';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;

const config: Knex.Config = {
  client: 'pg',
  connection: {
    connectionString: dbUrl,
    ssl: dbUrl?.includes('supabase')
      ? { rejectUnauthorized: false }
      : false,
  },
  migrations: {
    directory: './src/db/migrations',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
  seeds: {
    directory: './src/db/seeds',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
};

export default config;
