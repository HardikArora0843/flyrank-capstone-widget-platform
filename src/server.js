import { createApp } from './app.js';
import { config } from './config/env.js';
import { defaultJobWorker } from './jobs/jobWorker.js';
import { pool } from './db/pool.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(` FlyRank Widget & Lead-Capture Platform Running`);
  console.log(` Mode: ${config.env}`);
  console.log(` Port: ${config.port}`);
  console.log(` Base URL: ${config.baseUrl}`);
  console.log(` Health Check: ${config.baseUrl}/health`);
  console.log(`====================================================`);

  // Start background job worker
  defaultJobWorker.start();
});

// Graceful Shutdown
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  defaultJobWorker.stop();
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('Database pool closed.');
    } catch (err) {
      console.error('Error closing database pool:', err);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
