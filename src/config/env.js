import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  db: {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/widget_platform',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'widget_platform',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_capstone_jwt_key_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxPerIp: parseInt(process.env.RATE_LIMIT_MAX_PER_IP || '30', 10),
    maxPerWidget: parseInt(process.env.RATE_LIMIT_MAX_PER_WIDGET || '60', 10),
  },

  geo: {
    providerATimeoutMs: parseInt(process.env.GEO_PROVIDER_A_TIMEOUT_MS || '1500', 10),
    providerBTimeoutMs: parseInt(process.env.GEO_PROVIDER_B_TIMEOUT_MS || '1500', 10),
    providerAUrl: process.env.GEO_PROVIDER_A_URL || 'http://ip-api.com/json',
    providerBUrl: process.env.GEO_PROVIDER_B_URL || 'https://ipapi.co',
  },

  email: {
    mode: process.env.EMAIL_MODE || 'console',
    mailpitHost: process.env.MAILPIT_HOST || 'localhost',
    mailpitPort: parseInt(process.env.MAILPIT_PORT || '1025', 10),
  },

  jobs: {
    pollIntervalMs: parseInt(process.env.JOB_POLL_INTERVAL_MS || '3000', 10),
    maxAttempts: parseInt(process.env.JOB_MAX_ATTEMPTS || '3', 10),
  },
};
