import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pgliteInstance = null;
let pgPool = null;
let useEmbedded = false;

// Ensure local data dir exists for persistent embedded Postgres
const dataDir = path.join(__dirname, '..', '..', 'data', 'postgres_db');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function getPgLite() {
  if (!pgliteInstance) {
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
  }
  return pgliteInstance;
}

export async function initDb() {
  if (process.env.USE_EMBEDDED_PG === 'true') {
    useEmbedded = true;
    return getPgLite();
  }

  try {
    const tempPool = new pg.Pool({
      connectionString: config.db.connectionString,
      connectionTimeoutMillis: 1500,
    });
    const client = await tempPool.connect();
    client.release();
    pgPool = tempPool;
    useEmbedded = false;
    return pgPool;
  } catch (err) {
    // Fall back to embedded PGlite (full Postgres 16 in-process)
    console.log('[Database] External Postgres not reachable. Falling back to embedded PostgreSQL (PGlite)...');
    useEmbedded = true;
    return getPgLite();
  }
}

export const query = async (text, params = []) => {
  if (useEmbedded || (!pgPool && !process.env.DATABASE_URL?.includes('localhost:5432'))) {
    const db = await getPgLite();
    const res = await db.query(text, params);
    return {
      rows: res.rows || [],
      rowCount: res.rows ? res.rows.length : 0,
    };
  }

  if (!pgPool) {
    try {
      pgPool = new pg.Pool({
        connectionString: config.db.connectionString,
        connectionTimeoutMillis: 1500,
      });
      const client = await pgPool.connect();
      client.release();
    } catch {
      useEmbedded = true;
      const db = await getPgLite();
      const res = await db.query(text, params);
      return {
        rows: res.rows || [],
        rowCount: res.rows ? res.rows.length : 0,
      };
    }
  }

  return pgPool.query(text, params);
};

export const exec = async (sql) => {
  if (useEmbedded) {
    const db = await getPgLite();
    return db.exec(sql);
  }

  if (!pgPool) {
    await initDb();
  }

  if (useEmbedded) {
    const db = await getPgLite();
    return db.exec(sql);
  }

  return pgPool.query(sql);
};

export const getClient = async () => {
  if (useEmbedded) {
    const db = await getPgLite();
    return {
      query: async (text, params = []) => {
        const res = await db.query(text, params);
        return {
          rows: res.rows || [],
          rowCount: res.rows ? res.rows.length : 0,
        };
      },
      exec: async (sql) => db.exec(sql),
      release: () => {},
    };
  }

  if (!pgPool) {
    await initDb();
  }

  if (useEmbedded) {
    const db = await getPgLite();
    return {
      query: async (text, params = []) => {
        const res = await db.query(text, params);
        return {
          rows: res.rows || [],
          rowCount: res.rows ? res.rows.length : 0,
        };
      },
      exec: async (sql) => db.exec(sql),
      release: () => {},
    };
  }

  const client = await pgPool.connect();
  client.exec = (sql) => client.query(sql);
  return client;
};

export const pool = {
  query,
  exec,
  connect: getClient,
  end: async () => {
    if (pgPool) await pgPool.end();
    if (pgliteInstance) await pgliteInstance.close();
  },
};
