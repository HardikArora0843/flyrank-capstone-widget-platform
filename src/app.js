import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { corsHandler } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import widgetRoutes from './routes/widget.routes.js';
import submissionRoutes from './routes/submission.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import healthRoutes from './routes/health.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = () => {
  const app = express();

  // Trust proxy for real client IP resolution behind reverse proxies / docker
  app.set('trust proxy', 1);

  // Global CORS Middleware
  app.use(corsHandler);

  // Static files for client script delivery (e.g. /widget.v1.js) with long-term caching
  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
      },
    })
  );

  // Payload body size limit enforced at 10kb
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // API Routes
  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/widgets', widgetRoutes);
  app.use('/api/submissions', submissionRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Catch 404s for undefined routes
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.originalUrl}`,
      },
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
};
