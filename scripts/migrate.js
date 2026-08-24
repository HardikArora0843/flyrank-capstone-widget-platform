import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, getClient, initDb } from '../src/db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  await initDb();
  const client = await getClient();
  try {
    console.log('--- Running Database Migrations ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT name FROM _migrations WHERE name = $1', [file]);
      if (rows.length === 0) {
        console.log(`Applying migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        if (client.exec) {
          await client.exec(sql);
        } else {
          await client.query(sql);
        }
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        console.log(`✓ Applied: ${file}`);
      } else {
        console.log(`Skipping already applied: ${file}`);
      }
    }
    console.log('All migrations applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
